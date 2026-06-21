# LUCY 2.0 — Seam Report + Presentation Interface Contract (Phase 1)

## Verdict
**Presentation and logic are cleanly separable — no behavior-preserving logic refactor is required.**
Lucy 1.0 screens/components consume logic by importing **named functions** from the logic layers
(`db, processing, scheduling, ai, voice, audio, server`). Those functions are self-contained and never
import back from `screens/` or `components/` — the dependency arrow points one way (UI → logic). Therefore
the UI can be rebuilt by writing new screens that **call the same functions with the same arguments**.

**The seam is the import boundary.** Parity is preserved as long as new presentation calls the identical
logic entry points. We formalize it with a thin **hooks layer** (`app/src/screens/hooks/`, to be built in
Workstream F) that wraps these calls so screens depend on hooks, and hooks depend on frozen logic.

### Entanglement risks (presentation-side only — fixable without touching logic)
- **`Dashboard.tsx` (4058 LOC)** fuses Timeline + Brain + Ask + Mood + Projects + Dr.Lucy into one file.
  → Decompose into separate redesigned screens, each binding to its slice (see contract below).
- **`Settings.tsx` (2031 LOC)** fuses models/privacy/connectors/export/voice/dev.
  → Decompose into Settings sections.
- **`ScheduleTab.tsx` (1356)`, `StalenessReviewCard.tsx`, `ProjectsTab.tsx`, `DayShaper.tsx`,
  `MoneyGoals.tsx`** are logic-bound mini-features → rebuild as self-contained redesigned components
  calling the same logic.
- 18/37 components are **pure presentation** (props only) → trivial restyle on the new design system.

## Presentation Interface Contract (the functions the UI may call — do not change their signatures)
> New screens MUST bind only to these. If a redesign needs something not here, it's a suspected logic gap →
> log in PROJECT_STATE, do not edit logic.

### Capture / core-loop
| Screen | Logic entry points (frozen) |
|--------|------------------------------|
| Capture | `processing/extract`: `enqueueTranscript`, `analyzeTranscript`; `processing/automationEngine`: `detectAutomationIntent`, `executeAction`; `ai/remoteAccess`: `getRemoteAccessState`; `audio/micCoordinator`: `acquireMic`,`releaseMic`; `voice/wakeWord`: `wakeWord`; `voice/onDeviceSpeech`: `resolveSpeechMode`; `db/todos`: `listPendingTodos`,`archiveTodo`; `db/projects`: `listProjects`,`assignTodoToProject`; types: `ExtractionResult`. |
| Ask (recall) | `processing/ask`: `askLucy`; `processing/lucyActions`: `executeActions`,`summarizeAction`; `processing/insightEngine`: `getStoredInsights`,`generateDailyInsights`; `processing/automationEngine`: `detectAutomationIntent`,`executeAction`; `processing/artifactCleanup`: `isInvalidDeadline`,`isInvalidPendingTask`; `processing/privacy`: `protectedPreview`; `processing/extract`: `enqueueTranscript`. |

### Home / Timeline / Brain (currently inside Dashboard.tsx — to be split)
| Slice | Logic entry points |
|-------|--------------------|
| Timeline | `db/captures`: `captureStatus`,`listCaptureUpdates`,`listRecentCaptures`,`listListenSessions`,`assignCaptureToProject`; `processing/extract`: `enqueueTranscript`; `processing/organizer`: `organizeMemory`; `processing/privacy`: `protectedPreview`; `processing/meetingFormat`: `formatMeetingRowText`. |
| Lists | `db/todos`,`db/reminders`,`db/expenses`,`db/ideas`,`db/openLoops`(`resolveOpenLoop`),`db/followUps`(`resolveFollowUp`),`db/contextRequests`(`answerContextRequest`,`listOpenContextRequests`),`db/projects`. |
| Mood / health | `processing/moodGraph` types; `processing/drLucy`: `DR_LUCY_DISCLAIMER`. |

### Settings (to be split into sections)
`ai/device`(`getDeviceModelState`,`prepareDeviceModel`,`selectDeviceModel`,`subscribeToDeviceModel`,`clearDownloadedDeviceModels`),
`ai/modelCatalog`(`localModelOptions`), `ai/remoteAccess`(`getRemoteAccessState`),
`ai/modelPreference`(`getRoleModels`,`getTokenMode`,`persistRoleModel`), `db/settings`(`getSetting`,`setSetting`),
`db/userProfile`(`getUserProfile`,`saveUserProfile`), `db/captures`(`getCaptureQueueSummary`,`getLowImportanceCaptures`),
`db/knowledge`(`getLatestOrganizationRun`), `processing/background`(`getBackgroundProcessingState`),
`processing/benchmark`(`runEnglishDeviceBenchmark`), `processing/organizer`(`organizeMemory`),
`voice/wakeWord`, `voice/tts`(`listVoices`,`setVoice`,`getSelectedVoiceId`,`loadVoicePrefs`,`speak`).

### Other screens
- **Galaxy** (Brain tree): UI-only over `config` + receives data via props from brain DB listers (`db/brainTopics`).
- **Connectors**: `db/settings`, `processing/calendarConnector`(`requestCalendarPermission`,`hasCalendarPermission`), `audio/PassiveListener`(`passiveListener`), `processing/notifications`(`scheduleProgressCheckIn`,`cancelProgressCheckIn`).
- **StoryView**: `db/captures` (`CaptureRow`) — UI over passed captures.

### Logic-bound components (rebuild as self-contained, same calls)
`ScheduleTab`(6), `StalenessReviewCard`(6), `ProjectsTab`(4), `DayShaper`(3), `MoneyGoals`(3),
`CheckInScheduler`(2), `CommitmentsSection`(2), `MeetingMode`(2), `ScheduledRemindersManager`(2),
plus 1-import: `AlarmOverlay, ApprovalInbox, ConversationModal, DevLogViewer, DocumentsTab, FreeUpSpace,
LearnedProfilePanel, LaptopAccessPanel, LucyWrapped, NotificationCenter`.

### Pure-presentation components (restyle only)
`AnimatedFace, Motion, SegmentedControl, ActionSheet, ReviewCardDeck, SummaryCard, CollapsibleSection,
PrivacyBadge, ShieldedText, SplashAnimation, LucyPeek, LucyEmptyState, Onboarding, Banner-likes,
MemoryDetailSheet, MeetingShareBar, ErrorBoundary, WorkspaceHome` (props-driven).

## App.tsx seam (root)
`App.tsx` owns: tab navigation (Home/Brain/Ask/Health/Focus Now), share-intent ingestion, deep links
(`lucy://voice|capture`, Siri), notification-response routing, alarm raising, hourly foreground
location+health snapshots, Brain-Pulse + listen-digest schedulers, OTA check, LAN-server autostart,
Dynamic-Island. **Plan:** extract a `navigation/` module + per-concern hooks; keep all the wiring calls
identical (they target frozen logic). New providers (EntitlementProvider, TelemetryProvider, Sentry,
ToastProvider, ThemeProvider) wrap the tree here — integration owned by orchestrator.

## Recommendation (how Workstream F binds safely)
1. Build `app/src/screens/hooks/` (e.g., `useTimeline`, `useCaptureInput`, `useAsk`, `useSettingsModel`)
   that call the contract functions above — the only place screens touch logic.
2. Rebuild screens on `app/src/ui/` primitives consuming those hooks.
3. Decompose `Dashboard.tsx` + `Settings.tsx` per the slices above.
4. QA each screen's catalog rows present (Phase 5).

**Conclusion: redesign is technically safe with zero logic edits.** The seam holds at the import boundary;
formalized by the hooks layer.
