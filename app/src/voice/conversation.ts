/**
 * Conversation engine — a hands-free, multi-turn spoken loop with LUCY (ChatGPT-voice style):
 *
 *   listen (on-device STT) → think (command brain) → speak reply (TTS) → listen again …
 *
 * Each finished utterance runs through runVoiceCommand, so the user can both ASK questions and TAKE
 * actions ("schedule a walk at 6", "remember that…") entirely by voice. Recognition is paused while
 * LUCY speaks so she never transcribes her own voice. Uses the shared mic coordinator so Listen mode
 * and the wake word yield while a conversation is active.
 */
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { acquireMic, releaseMic } from '../audio/micCoordinator';
import { speak, stopSpeaking } from './tts';
import { resolveSpeechMode } from './onDeviceSpeech';

export type ConvoState = 'off' | 'listening' | 'thinking' | 'speaking';
export interface ConvoTurn { role: 'user' | 'lucy'; text: string }
export interface ConvoSnapshot { state: ConvoState; turns: ConvoTurn[]; partial: string; error: string | null }

// Spoken phrases that end the conversation. Kept conservative so normal mid-chat words don't end it.
const END_RE = /\b(stop listening|stop conversation|end conversation|never mind|that'?s all|that is all|that'?s it|that is it|good ?bye|^bye$|we'?re done|i'?m done|i'?m good|all done|all set|thank you|thanks|that'?ll be all|that'?ll do)\b/i;

// Close the conversation after this long with no speech from the user (hands-free auto-timeout) so it
// never "keeps listening" forever. Re-armed on every speech result, so it's a pure-silence window.
const SILENCE_MS = 5000;

class ConversationManager {
  private state: ConvoState = 'off';
  private turns: ConvoTurn[] = [];
  private partial = '';
  private error: string | null = null;
  private active = false;
  private locale = 'en-US';
  private onDevice = false; // whether an on-device model is ready for this.locale (else OS recognizer)
  private context: string | undefined;
  private getContext: (() => string) | null = null;
  private onNavigate: ((section: string) => void) | null = null;
  private subs: Array<{ remove(): void }> = [];
  private listeners = new Set<(s: ConvoSnapshot) => void>();
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private audioRetries = 0; // consecutive transient audio-capture failures before we give up
  private convId: number | null = null; // persisted voice-conversation row (for review later)

  /** Fire-and-forget persist of one turn so conversations are reviewable in-app + on the web. */
  private logTurn(role: 'user' | 'lucy', text: string): void {
    const id = this.convId;
    if (!id || !text?.trim()) return;
    void (async () => {
      try {
        const { getDatabase } = await import('../db');
        const { addVoiceTurn } = await import('../db/voiceConversations');
        await addVoiceTurn(await getDatabase(), id, role, text);
      } catch { /* persistence is non-critical */ }
    })();
  }

  subscribe(fn: (s: ConvoSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => { this.listeners.delete(fn); };
  }
  private snapshot(): ConvoSnapshot { return { state: this.state, turns: [...this.turns], partial: this.partial, error: this.error }; }
  private emit(): void { const s = this.snapshot(); for (const l of this.listeners) l(s); }
  private set(state: ConvoState): void { this.state = state; this.emit(); }
  getState(): ConvoState { return this.state; }

  /** (Re)start the no-speech countdown. Fires a calm, silent end if the user stays quiet. */
  private armSilence(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      // User went quiet — close the conversation without speaking (so we don't reopen the mic). This is
      // what stops "it kept listening and never stopped".
      if (this.active) void this.end();
    }, SILENCE_MS);
  }
  private clearSilence(): void {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
  }

  async start(opts?: { context?: string; getContext?: () => string; onNavigate?: (section: string) => void; initialText?: string }): Promise<void> {
    if (this.state !== 'off') return;
    this.context = opts?.context;
    this.getContext = opts?.getContext ?? null;
    this.onNavigate = opts?.onNavigate ?? null;
    this.turns = []; this.partial = ''; this.error = null;
    this.active = true;
    // Persist this conversation so it can be reviewed later (non-blocking).
    this.convId = null;
    void (async () => {
      try {
        const { getDatabase } = await import('../db');
        const { startVoiceConversation } = await import('../db/voiceConversations');
        this.convId = await startVoiceConversation(await getDatabase(), opts?.context ?? null);
      } catch { /* non-critical */ }
    })();
    acquireMic('conversation');
    this.set('thinking'); // brief "warming up" before the first listen

    // Permission + on-device availability (same gates as Listen mode).
    try {
      const perm = await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync();
      if (!perm.granted || !ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        return this.fail('Microphone or speech recognition is unavailable. Enable it in Settings.');
      }
    } catch (e) {
      return this.fail(`Could not start voice: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const { getDatabase } = await import('../db');
      const { getUserProfile } = await import('../db/userProfile');
      const { resolveSupportedSpeechLocale } = await import('../audio/transcriptionLanguage');
      // Resolve to a locale the recognizer actually supports — unsupported languages (e.g. Telugu te-IN)
      // otherwise failed with `language-not-supported` and broke the conversation.
      this.locale = await resolveSupportedSpeechLocale((await getUserProfile(await getDatabase())).languages);
    } catch { /* default en-US */ }
    // Prefer on-device transcription; if the model for this locale isn't downloaded yet, this also
    // kicks off its download so the device self-heals to fully-private. Until then the OS recognizer
    // handles it (same pragmatic stance as the wake word) so the conversation still works.
    try {
      const mode = await resolveSpeechMode(this.locale);
      this.onDevice = mode.onDevice;
    } catch { this.onDevice = false; }

    this.configureListeners();
    if (opts?.initialText) {
      await this.handleUtterance(opts.initialText);
    } else {
      await speak("I'm listening — what's up?");
      if (!this.active) return;
      this.beginListening();
    }
  }

  private configureListeners(): void {
    this.clearListeners();
    this.subs = [
      ExpoSpeechRecognitionModule.addListener('result', (e: ExpoSpeechRecognitionResultEvent) => {
        if (this.state !== 'listening') return;
        const text = e.results[0]?.transcript?.trim() ?? '';
        if (!text) return;
        this.armSilence(); // user is speaking — reset the silence countdown
        if (!e.isFinal) { this.partial = text; this.emit(); return; }
        this.partial = '';
        void this.handleUtterance(text);
      }),
      ExpoSpeechRecognitionModule.addListener('error', (e: ExpoSpeechRecognitionErrorEvent) => {
        if (!this.active || e.error === 'aborted' || e.error === 'no-speech') return;
        // 'interrupted' = a transient audio-session blip (usually TTS starting/stopping while we
        // also hold the recognizer). Never end the conversation over it — just resume listening.
        if (e.error === 'interrupted') {
          if (this.state === 'listening') { this.endTimer = setTimeout(() => this.startRecognition(), 350); }
          return;
        }
        // 'audio-capture' (iOS kAFAssistantErrorDomain 209) is usually a transient audio-session blip as
        // TTS hands the session back. Retry a couple of times, then close calmly — never surface a scary
        // error card mid-conversation.
        if (e.error === 'audio-capture') {
          if (this.state === 'listening' && this.audioRetries < 2) {
            this.audioRetries++;
            this.endTimer = setTimeout(() => this.startRecognition(), 500);
            return;
          }
          void this.end();
          return;
        }
        this.fail(`Voice error (${e.error}). ${e.message || ''}`.trim());
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        // The recognizer stops itself after each utterance; keep it alive while we're listening.
        if (this.active && this.state === 'listening') {
          this.endTimer = setTimeout(() => this.startRecognition(), 250);
        }
      }),
    ];
  }
  private clearListeners(): void { for (const s of this.subs) s.remove(); this.subs = []; }

  private beginListening(): void {
    if (!this.active) return;
    this.set('listening');
    this.armSilence();
    this.startRecognition();
  }

  private startRecognition(): void {
    if (!this.active || this.state !== 'listening') return;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: this.locale,
        interimResults: true,
        continuous: true,
        // Do NOT force on-device recognition. On iOS the on-device model is only installed for some
        // locales (typically en-US) — forcing it for e.g. en-IN (what a Telugu+English profile resolves
        // to) silently captured nothing, so the conversation "never listened". Letting the OS recognizer
        // choose (it uses on-device when available, else the cloud recognizer) makes it work for every
        // resolved locale — the same pragmatic stance the wake word already takes.
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        // 'voiceChat' enables Apple's voice-processing I/O (acoustic echo cancellation + noise
        // suppression). 'measurement' disabled it, so LUCY heard her own TTS through the speaker and
        // answered herself — the runaway "kept listening / talking back" loop.
        iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth'], mode: 'voiceChat' },
      });
    } catch (e) {
      this.fail(`Could not start listening. ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private async handleUtterance(text: string): Promise<void> {
    if (!this.active) return;
    this.clearSilence();   // we're handling a turn now; silence countdown re-arms when we listen again
    this.audioRetries = 0; // a real result means capture is healthy
    // Only end when the end-phrase is essentially the WHOLE utterance (≤5 words) — so "I'm done with
    // the report, schedule a break" keeps the conversation going instead of hanging up mid-command.
    if (END_RE.test(text) && text.trim().split(/\s+/).length <= 5) {
      this.turns.push({ role: 'user', text });
      this.logTurn('user', text);
      this.emit();
      const isThanks = /\b(thank you|thanks)\b/i.test(text);
      await this.speakAndEnd(isThanks ? "You're welcome — talk soon." : 'Okay — talk soon.');
      return;
    }
    // Pause recognition while thinking + speaking so LUCY doesn't hear herself.
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
    // Capture prior turns as history (before pushing this utterance) so LUCY remembers a
    // multi-step flow like a live demo walkthrough.
    const history = this.turns.map((t) => ({ role: t.role, content: t.text }));
    this.turns.push({ role: 'user', text });
    this.logTurn('user', text);
    this.set('thinking');
    let reply = '';
    let navigate: string | null = null;
    try {
      const { runVoiceCommand } = await import('./commandRouter');
      // Read the CURRENT screen each turn (live) so LUCY is aware of where the user navigated.
      const liveContext = this.getContext ? this.getContext() : this.context;
      const r = await runVoiceCommand(text, undefined, liveContext, history);
      reply = (r.speak || '').trim() || "I'm not sure about that one.";
      navigate = r.navigate ?? null;
    } catch {
      reply = 'Sorry — something went wrong with that. Try again?';
    }
    if (!this.active) return;
    this.turns.push({ role: 'lucy', text: reply });
    this.logTurn('lucy', reply);
    if (navigate && this.onNavigate) { try { this.onNavigate(navigate); } catch { /* non-critical */ } }
    this.set('speaking');
    await speak(reply);
    if (!this.active) return;
    // Let the audio session settle from playback→record before reopening the mic (reduces residual echo
    // and the iOS audio-capture error from switching too fast).
    await new Promise((r) => setTimeout(r, 300));
    if (!this.active) return;
    // If the user barged in (interrupt() flipped us to 'listening' mid-speech), don't double-start.
    if (this.state === 'speaking') this.beginListening(); // back to the user
  }

  /**
   * Barge-in: the user wants to take over while LUCY is talking (they've already read the reply).
   * Stops TTS immediately and starts listening, without waiting for the sentence to finish.
   */
  interrupt(): void {
    if (!this.active) return;
    if (this.state === 'speaking') {
      void stopSpeaking();
      this.beginListening(); // flips state to 'listening' so the awaited speak() won't re-listen
    }
  }

  private async speakAndEnd(text: string): Promise<void> {
    this.turns.push({ role: 'lucy', text });
    this.logTurn('lucy', text);
    this.set('speaking');
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
    await speak(text);
    await this.end();
  }

  private fail(message: string): void {
    this.error = message;
    void this.end();
  }

  async end(): Promise<void> {
    if (this.endTimer) { clearTimeout(this.endTimer); this.endTimer = null; }
    this.clearSilence();
    this.active = false;
    // Finalize the persisted conversation (marks ended_at; drops it if nothing was said).
    const finishId = this.convId; this.convId = null;
    if (finishId) {
      void (async () => {
        try {
          const { getDatabase } = await import('../db');
          const { endVoiceConversation } = await import('../db/voiceConversations');
          await endVoiceConversation(await getDatabase(), finishId);
        } catch { /* non-critical */ }
      })();
    }
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
    this.clearListeners();
    try {
      await stopSpeaking();
      this.partial = '';
      this.set('off');
    } finally {
      releaseMic('conversation');
    }
  }
}

export const conversation = new ConversationManager();
