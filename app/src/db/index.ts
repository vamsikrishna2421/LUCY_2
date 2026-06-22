import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { initializeSchema } from './init';

const DB_NAME = 'lucy.db';
const DATABASE_KEY_SETTING = 'lucy_database_key';
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function getDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DATABASE_KEY_SETTING);
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const created = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(DATABASE_KEY_SETTING, created);
  return created;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    const key = await getDatabaseKey();
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version;');
    if (!cipher?.cipher_version) {
      throw new Error('Encrypted storage is unavailable. Use an Expo development build with SQLCipher enabled.');
    }
    await initializeSchema(db);
    return db;
  } catch (e) {
    // Close the half-open handle so a retry gets a clean connection instead of a wedged one.
    try { await db.closeAsync(); } catch { /* ignore */ }
    throw e;
  }
}

/**
 * Cold-start DB init can transiently fail (e.g. expo-sqlite "cannot rollback - no transaction is active")
 * — the kind of thing that clears if you close and reopen the app. Retry automatically a few times with a
 * short backoff before surfacing anything, so users never see that scary error and lose trust.
 */
async function openDatabaseWithRetry(): Promise<SQLite.SQLiteDatabase> {
  let lastError: unknown;
  // Spread retries over ~11s of wall-clock time. The transient cold-start race ("cannot rollback - no
  // transaction is active") settles a few seconds in — a quick burst of retries isn't enough, but a
  // PATIENT one recovers on its own (exactly what a manual close+reopen was doing), so the user almost
  // never sees the fallback card.
  const backoffsMs = [0, 1500, 3500, 6000];
  for (let i = 0; i < backoffsMs.length; i++) {
    if (backoffsMs[i] > 0) await new Promise((resolve) => setTimeout(resolve, backoffsMs[i]));
    try {
      return await openDatabase();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Never cache a REJECTED init — clear the handle on failure so the next call (or a user retry) re-inits
  // from scratch rather than being stuck with a permanently failed promise.
  databasePromise ??= openDatabaseWithRetry().catch((e) => {
    databasePromise = undefined;
    throw e;
  });
  return databasePromise;
}
