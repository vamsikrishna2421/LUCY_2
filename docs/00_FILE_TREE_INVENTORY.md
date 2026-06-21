# LUCY 1.0 — File-Tree Inventory (Phase 0, Step 0.1)

> Source of truth: `C:\Users\vamsy\Documents\Life_capture_application\life-capture`
> Forked (logic frozen) into this repo at `app/`. One line per source file: what it is responsible for.
> Stack: **Expo SDK 56 / React Native 0.85 / TypeScript / expo-sqlite**, on-device LLM via
> `react-native-executorch`, remote LLM via OpenAI/Claude, LAN companion server, heavy device-sensor use.
> Scale: **239 TS/TSX files in `src/` (~44.5k LOC) + `App.tsx` (74 KB)**.

Legend for later phases — visibility is assigned per-capability in the Feature Catalog, not here.

---

## Entry / Root
| Path | Responsibility |
|------|----------------|
| `App.tsx` | App root (74 KB). Bottom-nav host (Home/Timeline, Brain, Ask, Health, Focus Now), providers, splash gating, onboarding gate, global JS error logger install, notification-response routing, alarm raising, share-intent ingestion (text/image/PDF/link), deep links (`lucy://voice`,`lucy://capture`, Siri), hourly foreground location+health snapshots, Brain-Pulse + listen-digest schedulers, OTA check, LAN-server autostart, Dynamic-Island countdown. **Decomposition target for seam analysis.** |
| `index.ts` | Hermes entry; initializes RN core before Expo network patching; registers root component. |
| `src/splashTime.ts` | Neutral module recording JS start time for splash-duration math. |

## Config (`src/config`)
| Path | Responsibility |
|------|----------------|
| `config/index.ts` | Central runtime config (AI mode hybrid/offline, local inference target, model ids, flags) from env. |
| `config/colors.ts` | LUCY brand palette (premium dark + amber), shadows, pillar colors, theme-key reader. |
| `config/themes.ts` | Accent "skins" (lucy/whatsapp/facebook/snapchat/instagram) — swaps accent only. |
| `config/haptics.ts` | Haptic choreography + spring presets ("haptics as punctuation"). |

## Types (`src/types`)
| Path | Responsibility |
|------|----------------|
| `types/extraction.ts` | Core domain types: `PrivacyLevel`, `NoteType`, `ExtractionResult` and all extracted entities (task/expense/idea/place/interest/reminder…). The frozen data contract. |

## Utilities (`src/utils`)
| Path | Responsibility |
|------|----------------|
| `utils/datetime.ts` | Pure SQLite-timestamp parsing (`parseDbDate`/`dbDateMs`/`daysSinceDb`); UTC→local. Unit-tested. |

## AI / Provider layer (`src/ai`) — frozen "intelligence" surface
| Path | Responsibility |
|------|----------------|
| `ai/provider.ts` | AIProvider facade: routes extraction/prompts across device/Ollama/OpenAI/Claude; remote-availability + model-key status resolution. |
| `ai/device.ts` | On-device executorch model lifecycle (download/select/prepare/restore), guarded lazy native require. |
| `ai/deviceContext.ts` | Gathers full device context (battery/network/locale/usage) for the Ask engine; formats it. |
| `ai/claude.ts` | Claude API calls (extraction, vision, prompt). |
| `ai/openai.ts` | OpenAI API calls (extraction, prompt, task-routed). |
| `ai/ollama.ts` | Ollama dev-mode local inference. |
| `ai/prompts.ts` | All system/extraction prompts + app-context preamble + schema prompt. |
| `ai/modelCatalog.ts` | On-device model option catalog (quick…deep-phi); lazy config builder. |
| `ai/modelPreference.ts` | In-memory model preference + role/task→model mapping; persisted to settings. |
| `ai/embeddings.ts` | Embedding generate/store/load, cosine similarity, stale re-embed. |
| `ai/embeddingModel.ts` | Embedding-model identity + staleness logic (OpenAI vs keyword). Pure, tested. |
| `ai/rateLimit.ts` | AI cost guard: per-hour call cap, snooze, call accounting. |
| `ai/remoteAccess.ts` | Remote-access state + secure storage of OpenAI/Claude keys (expo-secure-store). |

## Audio (`src/audio`)
| Path | Responsibility |
|------|----------------|
| `audio/PassiveListener.ts` | On-device speech-recognition engine wrapper; the shared STT used by Listen/Meeting/conversation. |
| `audio/micCoordinator.ts` | Single-recognizer arbitration (ref-counted mic-busy flag) across listeners. |
| `audio/alarmManager.ts` | In-app persistent ringing alarm while foregrounded; raises from notification data. |
| `audio/liveActivity.ts` | Dynamic-Island/Live-Activity bridge for alarms + next-event countdown. |
| `audio/transcriptionLanguage.ts` | Maps app languages → device speech locales. |
| `audio/MusicDetector.ts` | Stub (ShazamKit removed) — music-match interface kept for callers. |

## Voice (`src/voice`)
| Path | Responsibility |
|------|----------------|
| `voice/commandRouter.ts` | "Hey Lucy" NL→action router across every feature; executes + returns spoken reply + nav hint. |
| `voice/conversation.ts` | Hands-free multi-turn spoken loop (STT→brain→TTS→repeat). |
| `voice/wakeWord.ts` | Foreground "hey lucy" wake-word listener (low-priority mic owner). |
| `voice/onDeviceSpeech.ts` | On-device speech provisioning / locale model download / mode resolution. |
| `voice/tts.ts` | Guarded expo-speech wrapper (speak/stop/list voices/prefs). |
| `voice/timeResolve.ts` | Pure day+HH:MM → epoch ms for the command brain. Unit-tested. |
| `voice/appManual.ts` | Single source of truth for in-app help / "what can you do" manual. |

## Data layer (`src/db`) — expo-sqlite, frozen schema
| Path | Responsibility |
|------|----------------|
| `db/index.ts` | DB singleton accessor + encryption key bootstrap (crypto/secure-store). |
| `db/init.ts` | Schema creation + migrations (837 LOC — all tables/indexes; **migration logic**). |
| `db/settings.ts` | Generic key/value settings get/set. |
| `db/captures.ts` | Captures CRUD; low-importance cleanup queries; structured-text updates. |
| `db/extractions.ts` | Per-capture extraction snapshots + evidence. |
| `db/todos.ts` | Tasks store; meta-task detection; categorization. |
| `db/reminders.ts` | Reminders store; dedup/exists checks; recurrence integration. |
| `db/expenses.ts` | Expense store; category normalization; amount parsing. |
| `db/ideas.ts` | Ideas store. |
| `db/places.ts` | Places store. |
| `db/interests.ts` | Interests upsert/list. |
| `db/people.ts` | People upsert; person-likeness heuristic; junk cleanup. |
| `db/projects.ts` | Projects (Workspace) store + alias handling. |
| `db/commitments.ts` | Commitment guardian storage (promises made / owed, deadlines, status). |
| `db/followUps.ts` | Follow-up store. |
| `db/openLoops.ts` | Open-loop (unfinished thread) store. |
| `db/contextRequests.ts` | "Need context" requests (open/answered/dismissed, priority). |
| `db/questions.ts` | Recognized question-intent signals + summaries. |
| `db/knowledge.ts` | Knowledge-graph entity/connection drafts (confidence tiers). |
| `db/brainTopics.ts` | Brain Galaxy topic tree + topic items. |
| `db/brainPulses.ts` | Brain-Pulse synthesis rows (unseen queue). |
| `db/learnedProfile.ts` | Durable learned facts about the user (preference/habit/trait/routine/goal/correction). |
| `db/userProfile.ts` | User profile (name, locale, speech locale). |
| `db/schedule.ts` | LUCY-scheduled task-blocks (proposed/committed/done/cancelled) above device calendar. |
| `db/medications.ts` | Medications tracker (name/dosage/times) for Dr. Lucy. |
| `db/healthNutrition.ts` | Body profile, nutrition goals, food log. |
| `db/healthSnapshots.ts` | Daily health snapshots (activity). |
| `db/moneyGoals.ts` | Savings goals + contributions + progress assembly. |
| `db/expenses.ts` *(see above)* | — |
| `db/meetingSummaries.ts` | Meeting-mode summaries. |
| `db/musicCaptures.ts` | Passive music captures. |
| `db/locationSnapshots.ts` | Location snapshots + per-day summaries. |
| `db/deviceStats.ts` | Battery/device-stat snapshots. |
| `db/askThreads.ts` | Ask conversation threads + messages. |
| `db/voiceConversations.ts` | Voice-conversation transcripts (turns). |
| `db/notificationLog.ts` | In-app notification bell log + filters + dedup. |
| `db/devLog.ts` | Developer/debug log rows. |
| `db/errorLog.ts` | Error log rows (`logError`). |
| `db/entityEditProposals.ts` | Propose-and-confirm: append capture to existing project. |
| `db/memoryUpdateProposals.ts` | Propose-and-confirm: memory correction/enrichment. |

## Processing layer (`src/processing`) — frozen business/AI logic (89 files)
**Capture pipeline & extraction**
| Path | Responsibility |
|------|----------------|
| `processing/extract.ts` | Core capture→extraction pipeline (calls AIProvider, persists entities). |
| `processing/schema.ts` | Validates/normalizes raw LLM JSON into `ExtractionResult`. |
| `processing/explicitEnglish.ts` | Deterministic explicit-fact extraction fallback. |
| `processing/privacy.ts` | Privacy-level classification of captures. |
| `processing/redaction.ts` | Remote redaction placeholder mapping. |
| `processing/sensitiveShield.ts` | On-device password/name detect + tokenize/restore so secrets never reach remote LLM. |
| `processing/sensitiveNames.data.ts` | Static name data for on-device detection. |
| `processing/deviceNer.ts` | On-device named-entity recognition for the shield. |
| `processing/thoughtSplitter.ts` | Split one long capture into distinct thoughts. |
| `processing/journalSplitter.ts` | Split dated journal sections into timestamped captures. |
| `processing/mergeCapture.ts` | Merge related captures. |
| `processing/reprocess.ts` | Re-run extraction over captures. |
| `processing/organizer.ts` | Apply answered context requests; reorganize structured text. |
| `processing/markdown.ts` | Render captures/connections to markdown (vault). |
| `processing/structuredMemory.ts` | Build structured-memory text from extraction. |
| `processing/benchmark.ts` | Extraction benchmarking harness. |

**Recall / Ask / tools**
| Path | Responsibility |
|------|----------------|
| `processing/ask.ts` | Ask/recall engine (memory answer assembly across domains). |
| `processing/askIntent.ts` | Question-intent recognizers (today-plan, spending windows…). |
| `processing/vectorSearch.ts` | Multi-signal retrieval (vector + BM25), mem0-style. |
| `processing/tools/types.ts` | Semantic tool-layer types (ToolContext/Result/LucyTool). |
| `processing/tools/registry.ts` | The set of focused tools LUCY can pick from. |
| `processing/tools/selector.ts` | LLM tool selection + fast-route; pure parse. |
| `processing/tools/describe.ts` | Pure selector descriptions (test-safe). |
| `processing/tools/merge.ts` | Run selected tools (parallel) + fuse into one answer. |
| `processing/tools/index.ts` | Semantic-router entry (dark-launched via setting). |
| `processing/tools/impl/{spending,moneyWatch,moneyGoals,tasks,health,reminders,people,keepWarm,commitments,knowledge,memory}.ts` | 11 tool implementations (each answers a question domain). |

**Insight / synthesis / proactive**
| Path | Responsibility |
|------|----------------|
| `processing/insightEngine.ts` | General insight generation. |
| `processing/brainClassify.ts` | LLM topic classification + life-area seeding (Brain Galaxy). |
| `processing/brainPulse.ts` | 6-hour cross-domain brain synthesis. |
| `processing/knowledgeProjection.ts` | Pure KG projection (entities + co-occurrence). Tested. |
| `processing/reflectOnUser.ts` | Daily "learn about you" reflection pass. |
| `processing/morningBrief.ts` | Morning brief assembly. |
| `processing/weeklyInsight.ts` | Weekly insight assembly. |
| `processing/listenDigest.ts` | End-of-day digest from passive audio. |
| `processing/onThisDay.ts` | Retrospective memory surfacing. |
| `processing/lucyWrapped.ts` | Quarterly "Wrapped" summary. |
| `processing/lucyLens.ts` | Visual memory extraction (vision). |
| `processing/lucyActions.ts` | NL reorganization → approved actions on task list. |
| `processing/deviceInsights.ts` | Device-intelligence insights. |
| `processing/moodGraph.ts` | Mood-over-time valence series. |
| `processing/sentiment.ts` | On-device heuristic sentiment fallback. |
| `processing/relationshipEngine.ts` | Relationship gaps / keep-in-touch detection. |
| `processing/temporalEngine.ts` | Overdue items, relationship gaps, mood trend (temporal queries). |
| `processing/temporalAnchor.ts` | Temporal-anchor extraction. |

**Commitments / follow-ups / reminders / scheduling-adjacent**
| Path | Responsibility |
|------|----------------|
| `processing/commitments.ts` | Commitment/deadline extractor. |
| `processing/commitmentGuardian.ts` | Surface + chase at-risk commitments. |
| `processing/followUp.ts` | Follow-up creation from captures. |
| `processing/followUpDedup.ts` | Pure follow-up dedup. Tested. |
| `processing/reminderRecurrence.ts` | Pure repeating-reminder helpers. |
| `processing/reminderTime.ts` | Parse reminder times/dates. |
| `processing/persistentReminders.ts` | "Nag" reminders that buzz until acknowledged. |
| `processing/notifications.ts` | Notification scheduling/formatting. |
| `processing/automationEngine.ts` | Automation rules engine (Phase 1). |
| `processing/errandBatch.ts` | Pure errand batching/grouping. |
| `processing/geofenceReminders.ts` | Geofenced reminders. |
| `processing/backgroundLocation.ts` | Background location tracking for travel timeline. |
| `processing/background.ts` | Background task registration/runner. |
| `processing/recordLifeContext.ts` | Foreground location+health snapshot recorder. |

**Health / Dr. Lucy**
| Path | Responsibility |
|------|----------------|
| `processing/drLucy.ts` | Safety-first health guardian (deterministic triggers; LLM only voices). |
| `processing/drLucyContext.ts` | Cross-domain health context (meals/mood/sleep). |
| `processing/calorieEngine.ts` | Pure calorie/energy-balance math. Tested. |
| `processing/foodDb.ts` | Local Indian-food portion DB (offline). |
| `processing/foodNutrition.ts` | Food→nutrition estimation (intake logging). |
| `processing/healthSummary.ts` | Daily health picture (activity+intake+profile). |
| `processing/healthInsights.ts` | HealthKit insights. |
| `processing/mealReminders.ts` | Meal-photo nudge loop. |
| `processing/medicationReminders.ts` | Daily medication dose notifications. |

**Money**
| Path | Responsibility |
|------|----------------|
| `processing/moneyGoals.ts` | Pure savings-goal math/guidance. |
| `processing/goalDetect.ts` | Pure savings-goal detector from text. |
| `processing/goalPlanner.ts` | Goal propose-and-confirm → real money goal. |
| `processing/moneyWatch.ts` | Recurring charges / bill forecast / anomaly guardian. |
| `processing/expenseWindow.ts` | Pure expense-window helpers. |
| `processing/receiptOCR.ts` | Receipt OCR. |
| `processing/receiptScan.ts` | Receipt scan capture flow. |

**Autopilots (propose-and-confirm features)**
| Path | Responsibility |
|------|----------------|
| `processing/moveLease.ts` | Pure move/lease detector. Tested. |
| `processing/movePlan.ts` | Move/lease autopilot (spin up project + checklist). |
| `processing/trip.ts` | Pure trip detection + checklist + date math. |
| `processing/tripEnrichment.ts` | Pure trip enrichment. Tested. |
| `processing/tripPlanner.ts` | Trip autopilot (seed "Trip to X" project + check-ins). |
| `processing/projectAutopilot.ts` | Propose Workspace projects from brain clusters. |
| `processing/proposeMemoryUpdates.ts` | Propose memory corrections/enrichments. |

**Capture inputs / media**
| Path | Responsibility |
|------|----------------|
| `processing/imageCapture.ts` | Image picker capture flow. |
| `processing/smartPhotoCapture.ts` | One-tap photo → vision classifies meal/receipt/note. |
| `processing/meetingMode.ts` | Meeting-mode capture + summary. |
| `processing/meetingFormat.ts` | Format meeting summaries. |

**Vault / memory portability**
| Path | Responsibility |
|------|----------------|
| `processing/vault.ts` | On-disk markdown vault writer (expo-file-system). |
| `processing/vaultPolicy.ts` | When to write markdown. |
| `processing/documentVault.ts` | Persistent on-device document library. |
| `processing/memoryExport.ts` | Build comprehensive memory export JSON (Settings + LAN). |
| `processing/memoryImport.ts` | Restore export JSON onto a device (id-preserving). |
| `processing/onlineResource.ts` | Saved links/online resources store + flow. |
| `processing/artifactCleanup.ts` | Clean up stale artifacts (reminders/todos). |
| `processing/stalenessEngine.ts` | Staleness detection + cleanup engine. |
| `processing/calendarConnector.ts` | Device-calendar connector. |
| `processing/textActions.ts` | Text-action helpers (summarize/rewrite via AI). |
| `processing/seedDemoData.ts` | Seed demo data for first-time users. |

## Scheduling engine (`src/scheduling`) — pure, unit-tested core
| Path | Responsibility |
|------|----------------|
| `scheduling/types.ts` | Shared scheduler types (resources/energy/windows/blocks). |
| `scheduling/index.ts` | Orchestration: ties pure engine to DB + device calendar; public suggest API. |
| `scheduling/scheduler.ts` | Slot finder + conflict validator (pure). |
| `scheduling/resources.ts` | Exclusive-resource conflict core (can-coexist set logic). |
| `scheduling/classify.ts` | Heuristic task classifier → metadata (duration/recurrence/deadline). |
| `scheduling/freeBusy.ts` | Build unavailable blocks (sleep hard, habits soft). |
| `scheduling/availability.ts` | Availability profile (hours/sleep/protected/peak) infer+persist. |
| `scheduling/energy.ts` | Learned energy curve from mood entries. |
| `scheduling/learnedHabits.ts` | Suggest habit windows from user's own committed routine. |
| `scheduling/load.ts` | Effort-load model (brain/muscle/attention caps). |
| `scheduling/rearrange.ts` | Propose moving movable blocks to fit a new task. |
| `scheduling/scorer.ts` | Score candidate slots + human-readable rationale. |
| `scheduling/timingConstraint.ts` | Parse NL timing ("not tomorrow", "after the 25th") → window. |
| `scheduling/time.ts` | Local-time helpers (start-of-day, minutes, dow). |

## Server (`src/server`) — LAN companion
| Path | Responsibility |
|------|----------------|
| `server/localServer.ts` | PIN-gated foreground LAN web server (view/control memory from laptop); `/api/*`. |
| `server/dashboardHtml.ts` | The HTML dashboard served to the laptop browser. |

## Screens (`src/screens`) — UI (redesign targets)
| Path | Responsibility |
|------|----------------|
| `screens/Dashboard.tsx` | Home/Timeline + embedded Brain/Ask views (4058 LOC). Primary surface. |
| `screens/Settings.tsx` | Settings (2031 LOC) — models, privacy, connectors, export, themes, dev. |
| `screens/Capture.tsx` | Capture screen (text/voice/photo entry, replay). |
| `screens/Ask.tsx` | Ask Lucy recall conversation screen. |
| `screens/Galaxy.tsx` | Brain Galaxy hierarchical topic browser. |
| `screens/Connectors.tsx` | Device integrations + permissions hub. |
| `screens/StoryView.tsx` | Person/topic narrative thread ("it remembers everything"). |
| `screens/NotificationDetail.tsx` | Notification detail modal. |

## Components (`src/components`) — 37 UI building blocks (redesign targets)
| Path | Responsibility |
|------|----------------|
| `components/AnimatedFace.tsx` | LUCY orb/face with status states (idle/listening/thinking…). |
| `components/Motion.tsx` | Entrance/press animation primitives (FadeInUp/Stagger/ScreenFade/PressableScale). |
| `components/SegmentedControl.tsx` | Sliding segmented switcher (shared motion signature). |
| `components/ActionSheet.tsx` | Designed ActionSheet + Toast (replaces Alert). |
| `components/ReviewCardDeck.tsx` | Swipeable one-card review surface (PanResponder). |
| `components/ApprovalInbox.tsx` | Approval/review cards on app open. |
| `components/StalenessReviewCard.tsx` | Staleness + context-batch review cards. |
| `components/CaptureReplay.tsx` | Live capture-replay "wow" animation. |
| `components/DayShaper.tsx` | "Shape your day" capacity editor (hours/sleep/energy curves). |
| `components/ScheduleTab.tsx` | On-device calendar surface (1356 LOC). |
| `components/CommitmentsSection.tsx` | Commitment-guardian surface for Focus Now. |
| `components/MoneyGoals.tsx` | Savings-goal tracker UI. |
| `components/ProjectsTab.tsx` | Workspace → Projects. |
| `components/DocumentsTab.tsx` | In-app document vault. |
| `components/MeetingMode.tsx` | Meeting-mode UI. |
| `components/MeetingShareBar.tsx` | Share meeting summary. |
| `components/ConversationModal.tsx` | Non-blocking floating Lucy conversation card. |
| `components/NotificationCenter.tsx` | In-app notification bell center. |
| `components/MemoryDetailSheet.tsx` | Capture/memory detail sheet (edit). |
| `components/Onboarding.tsx` | First-run onboarding. |
| `components/SplashAnimation.tsx` | JS splash animation. |
| `components/LucyWrapped.tsx` | Wrapped animated reveal. |
| `components/LucyPeek.tsx` | Decorative peeking orb. |
| `components/LucyEmptyState.tsx` | Character-led empty states. |
| `components/SummaryCard.tsx` | Compact progressive-disclosure summary card. |
| `components/CollapsibleSection.tsx` | Collapsible count-badged section. |
| `components/FreeUpSpace.tsx` | Importance-based cleanup sheet. |
| `components/CheckInScheduler.tsx` | Check-in scheduling UI. |
| `components/ScheduledRemindersManager.tsx` | Manage scheduled reminders. |
| `components/AlarmOverlay.tsx` | Full-screen ringing alarm overlay. |
| `components/LaptopAccessPanel.tsx` | LAN companion control panel. |
| `components/LearnedProfilePanel.tsx` | Learned-profile viewer. |
| `components/PrivacyBadge.tsx` | Privacy-level badge. |
| `components/ShieldedText.tsx` | Renders shielded/tokenized sensitive values. |
| `components/SummaryCard.tsx` *(see above)* | — |
| `components/DevLogViewer.tsx` | Dev-log viewer. |
| `components/ErrorBoundary.tsx` | App-wide crash boundary + global JS error logger. |
| `components/WorkspaceHome.tsx` | Workspace command-center home. |

## Non-source / supporting
| Path | Responsibility |
|------|----------------|
| `web/dashboard.html` | Static LAN dashboard asset. |
| `tools/memory-viewer.html` | Standalone memory viewer. |
| `tools/needs-rebuild.mjs` | OTA "needs native rebuild" detector (script). |
| `plugins/withExecutorchJar.js` | Expo config plugin (Android executorch jar). |
| `patches/` | patch-package patches. |
| `assets/` | App icons / splash / brand images. |
| `tests/` (37 files) | tsx unit/validation/benchmark tests (calendar, calorie, shield, tools, kaggle evals…). The behavioral oracle for parity. |
| `docs/` (25 files) | 1.0 strategy/design docs (LUCY_DESIGN_SYSTEM, CALENDAR_STRATEGY, HEALTH_STRATEGY, MONETIZATION_STRATEGY, VAMSI_UNMET_NEEDS, COMPETITOR_COMPARISON…). Reference for 2.0. |
| `app.json` / `app.config.js` | Expo app config (permissions, plugins, bundle ids). |
| `eas.json` / `codemagic.yaml` | Build pipelines. |

## Unknown / to-confirm
- None unclassified. `ask_work.json` / `hist_work.json` are agent-tooling scratch (git-ignored).

---
*Step 0.1 complete. Step 0.2 (per-module Feature Catalog) is owned by the BA agent → `docs/10_FEATURE_CATALOG.md`.*
