# LifeOS: Event-Driven Multi-Agent Personal Workflow Orchestration

LifeOS is an event-driven, multi-agent personal workflow orchestration mobile platform built for Android using React Native and TypeScript.

Raw inputs (typed text, voice transcripts, notifications) are turned into a standardized, app-independent intent representation by an **Intent Identifier**, validated and coordinated deterministically by a **Supervisor Agent**, which constructs a typed **ActionPlan** and dispatches actions to internal agents.

---

## Architecture Pipeline

```
Raw Input (Text / Simulated Notifications)
            │
            ▼
     [Input Capture]  ─── produces ───>  InputEvent
            │
            ▼
    [Local Intent Identifier]  (100% Offline & Deterministic)
            │
            ▼
      IntentAnalysis  (What does the user want? No agent knowledge)
            │
            ▼
     [Supervisor Agent]  (How should it be executed? Owns registry & policies)
            │
            ▼
        ActionPlan  (Typed action graph with deterministic action IDs)
            │
            ▼
     [Calendar Agent]  ──>  [Calendar Adapter]  ──>  [Android CalendarProvider]
            │
            ▼
    Execution Result & SQLite Idempotency Mapping
```

---

## Android Native Calendar Integration (Calendar Agent & Adapter)

LifeOS integrates with Android's native calendar provider (`android.provider.CalendarContract`) using `expo-calendar` behind an abstract `CalendarAdapter` interface.

### 1. Constraints & Honest Sync Transparency
- **No Google Calendar REST API, OAuth, or Firebase**: LifeOS writes directly to Android's local content provider.
- **Honest Sync Reporting**: An insert into a Google-backed calendar writes to Android's native provider on the device. LifeOS transparently reports:
  > *"Inserted into &lt;calendar&gt;; Google sync depends on the account sync settings."*
  Cloud synchronization with Google Calendar on the web is performed asynchronously by Android's system sync service, not by LifeOS.
- **No Duplicate Event Storage**: SQLite does not store a duplicate copy of calendar event bodies. It only stores the LifeOS-to-Android mapping (`action_id`, `request_id`, `android_event_id`, `calendar_id`, `status`, timestamps, and errors).

### 2. Idempotency & Crash Recovery (SQLite Mapping)
LifeOS enforces strict idempotency using deterministic action IDs (e.g. `req_001_1_create_event`):
1. **Existing Check**: Before creating an event, LifeOS looks up `action_id` in SQLite. If `status === 'created'` and the event still exists on the device, it returns `success` with `duplicate: true` and the existing event ID without creating a duplicate.
2. **External Deletion Detection**: If the event was previously created by LifeOS but has since been deleted outside LifeOS (e.g. user deleted it in Google Calendar), LifeOS reports `event_not_found` and does **not** silently recreate it.
3. **Crash Recovery**: If an event insertion crashed midway, a `pending` row exists in SQLite. On retry, LifeOS searches the destination calendar for the marker `[LifeOS action_id: <action_id>]`. If found, it recovers the event without re-inserting.
4. **Insertion Flow**: Writes a `pending` row $\rightarrow$ Inserts event with marker $\rightarrow$ Reads event back to verify in provider $\rightarrow$ Updates row to `created`.

### 3. Permissions Policy
- Calendar permissions (`READ_CALENDAR`, `WRITE_CALENDAR`) are **never** requested at app startup. They are requested only when a calendar action needs them.
- Permission states handled: `granted`, `denied`, and `denied_permanently` (offers to open Android system settings).
- A denied permission returns a structured failure with `permission_denied` without crashing the app.

### 4. Calendar Selection & Writable Filtering
- LifeOS queries all device calendars and filters destination choices strictly to writable calendars (`allowsModifications === true` and access level is not read-only).
- The user can select their preferred destination calendar, which is persisted.
- If no writable calendar exists, the Supervisor returns `needs_clarification` with reason `no_writable_calendar`.

### 5. Event Updates & Deletions
- **Update**: Allowed only for events LifeOS created (verified in SQLite mapping).
- **Delete**: Allowed only for events LifeOS created. Deletion requires explicit user confirmation via an Android confirmation dialog before removing from `CalendarContract`.

### 6. Task Calendar Sync Flag
- Tasks default to local storage. An optional toggle (`createCalendarEventForTasks`) allows tasks with a due date and start time to also schedule a calendar event. The UI explicitly clarifies that calendar events are not tasks (no completion state).

---

## Native Build Requirements (Expo Go vs Development Build)

- **Expo SDK Version**: `58.0.19` (React Native `0.88.0`).
- **Native Permissions**: `expo-calendar` requires native Android permissions `READ_CALENDAR` and `WRITE_CALENDAR`, accessing `android.provider.CalendarContract` via Android Content Resolver.
- **Expo Go Limitation**: Modern Expo Go does not bundle native calendar permissions. Running native calendar operations on an Android device or emulator requires a **development build** (or prebuild).

### How to Run:

#### Option A: Local Android Development Build (Emulator or USB Device)
Ensure Android Studio and ADB are installed and an emulator is running:
```bash
npx expo run:android
```

#### Option B: Cloud Development Build with EAS
```bash
npx eas-cli@latest build --profile development --platform android
```
Install the generated `.apk` on your device and start the local bundler:
```bash
npx expo start --dev-client
```

---

## Running Automated Tests

All calendar operations, mock adapters, mapping persistence, idempotency, and supervisor workflows are covered by comprehensive unit tests:

```bash
npm test
```

### Test Suites Included:
1. `test/unit/calendarAgent.test.ts`:
   - Event creation & marker embedding
   - Idempotency & duplicate detection
   - External deletion detection (never silently recreates)
   - Crash recovery from pending row
   - Missing end time default (start + 60m)
   - Missing start time clarification (never guesses)
   - Permission denial handling
   - No writable calendar handling
   - Provider internal error recovery
   - Event update & confirmation-based deletion
   - Task calendar sync configuration flag
2. `test/unit/calendarAdapter.test.ts`: Adapter operations & honest source metadata
3. `test/unit/acceptanceTests.test.ts`: 8 Phase 1.5 acceptance tests
4. `test/evaluation/evaluation.test.ts`: 55-example evaluation dataset (100% accuracy)
5. Existing core unit tests: `inputCapture`, `intentAnalysisValidator`, `schemaValidator`, `ruleIdentifier`, `llmIdentifier`, `intentService`.
