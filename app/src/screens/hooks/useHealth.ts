/**
 * useHealth — the Health view's logic seam.
 *
 * The ONLY place a redesigned Health view should touch frozen logic. Wraps the exact entry points
 * Dashboard 1.0's HealthView + MoodGraphCard + BodyProfileSheet used, with identical arguments + the
 * same raw SQL:
 *
 *   processing/healthSummary       → getHealthSummary
 *   db/healthNutrition             → getBodyProfile, getFrequentFoods, deleteFoodLog, upsertBodyProfile
 *   processing/foodNutrition       → logFoodFromText, logFoodFromPhoto
 *   processing/imageCapture        → pickImage
 *   ai/provider                    → getModelKeyStatus, modelKeyMissingMessage
 *   db/healthSnapshots             → listHealthSnapshots
 *   processing/recordLifeContext   → generateHealthTip
 *   processing/moodGraph           → getMoodGraph, getDayHighlights (for MoodGraphCard)
 *   + the 7-day mood_entries SELECT.
 *
 * No logic is changed — behavior matches Health 1.0. This hook is provided so the Health view redesign
 * (the one remaining Dashboard view) can be done purely as presentation, exactly like Timeline/Library.
 */
import { useCallback } from 'react';
import { getDatabase } from '../../db';
import type { HealthSnapshot } from '../../db/healthSnapshots';
import type { HealthSummary } from '../../processing/healthSummary';
import type { BodyProfileRow } from '../../db/healthNutrition';

export interface MoodEntryLite { tone: string; created_at: string }

export interface UseHealth {
  loadActivity: () => Promise<{ health7: HealthSnapshot[]; mood7: MoodEntryLite[] }>;
  loadNutrition: () => Promise<{ summary: HealthSummary; profile: BodyProfileRow | null; frequentFoods: string[] }>;
  logFoodText: (text: string) => Promise<{ estimated: boolean }>;
  logFoodPhoto: (uri: string) => Promise<{ estimated: boolean }>;
  pickMealImage: () => Promise<string | null>;
  deleteFood: (id: number) => Promise<void>;
  saveBodyProfile: (profile: Partial<BodyProfileRow>) => Promise<void>;
  checkModelKey: () => Promise<{ ok: true } | { ok: false; message: string }>;
  healthTip: (steps: number, sleepHours: number | null, restingHr: number | null) => string | null;
  loadMoodGraph: (days?: number) => Promise<import('../../processing/moodGraph').MoodGraph>;
  loadDayHighlights: (dayMs: number) => Promise<import('../../processing/moodGraph').DayHighlight[]>;
}

export function useHealth(): UseHealth {
  const loadActivity = useCallback(async () => {
    const db = await getDatabase();
    const [health7, mood7] = await Promise.all([
      import('../../db/healthSnapshots').then((m) => m.listHealthSnapshots(db, 7)),
      db.getAllAsync<MoodEntryLite>(
        `SELECT tone, created_at FROM mood_entries WHERE created_at >= datetime('now', '-7 days') ORDER BY created_at DESC`,
      ),
    ]);
    return { health7, mood7 };
  }, []);

  const loadNutrition = useCallback(async () => {
    const db = await getDatabase();
    const { getHealthSummary } = await import('../../processing/healthSummary');
    const { getBodyProfile, getFrequentFoods } = await import('../../db/healthNutrition');
    const [summary, profile] = await Promise.all([getHealthSummary(db), getBodyProfile(db)]);
    let frequentFoods: string[] = [];
    try { frequentFoods = await getFrequentFoods(db, 6); } catch { /* non-critical */ }
    return { summary, profile, frequentFoods };
  }, []);

  const logFoodText = useCallback(async (text: string) => {
    const db = await getDatabase();
    const { logFoodFromText } = await import('../../processing/foodNutrition');
    return logFoodFromText(db, text);
  }, []);

  const logFoodPhoto = useCallback(async (uri: string) => {
    const db = await getDatabase();
    const { logFoodFromPhoto } = await import('../../processing/foodNutrition');
    return logFoodFromPhoto(db, uri);
  }, []);

  const pickMealImage = useCallback(async () => {
    const { pickImage } = await import('../../processing/imageCapture');
    return pickImage('Snap a meal', 'I’ll read the photo and estimate the foods and calories.');
  }, []);

  const deleteFood = useCallback(async (id: number) => {
    const db = await getDatabase();
    const { deleteFoodLog } = await import('../../db/healthNutrition');
    await deleteFoodLog(db, id);
  }, []);

  const saveBodyProfile = useCallback(async (profile: Partial<BodyProfileRow>) => {
    const db = await getDatabase();
    const { upsertBodyProfile } = await import('../../db/healthNutrition');
    await upsertBodyProfile(db, profile);
  }, []);

  const checkModelKey = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { getModelKeyStatus, modelKeyMissingMessage } = await import('../../ai/provider');
    const status = await getModelKeyStatus();
    if (status.remote && !status.keyPresent) return { ok: false, message: modelKeyMissingMessage(status) };
    return { ok: true };
  }, []);

  // generateHealthTip is a synchronous pure helper in 1.0 (required via require). Wrap it the same way.
  const healthTip = useCallback((steps: number, sleepHours: number | null, restingHr: number | null) => {
    const { generateHealthTip } = require('../../processing/recordLifeContext') as typeof import('../../processing/recordLifeContext');
    return generateHealthTip(steps, sleepHours, restingHr);
  }, []);

  const loadMoodGraph = useCallback(async (days = 30) => {
    const db = await getDatabase();
    const { getMoodGraph } = await import('../../processing/moodGraph');
    return getMoodGraph(db, days);
  }, []);

  const loadDayHighlights = useCallback(async (dayMs: number) => {
    const db = await getDatabase();
    const { getDayHighlights } = await import('../../processing/moodGraph');
    return getDayHighlights(db, dayMs);
  }, []);

  return {
    loadActivity, loadNutrition, logFoodText, logFoodPhoto, pickMealImage, deleteFood, saveBodyProfile,
    checkModelKey, healthTip, loadMoodGraph, loadDayHighlights,
  };
}
