# LifeOS (Phase 1 Prototype)

LifeOS is an event-driven, multi-agent personal workflow orchestration mobile platform built for Android using React Native and TypeScript.

In Phase 1, LifeOS converts raw multimodal inputs (text, voice transcripts, simulated notifications) into standardized, app-independent **ActionPlans** via an **Intent Identifier**, validated and coordinated deterministically before agent dispatch.

---

## Architecture Overview

```
Raw Input (Text / Voice / Notification)
             │
             ▼
      [Input Capture]  ─── produces ───>  InputEvent
             │
             ▼
    [Intent Identifier]
   ┌─────────────────────────────────────────────────────────┐
   │ 1. LLM-Based Identifier (Google Gemini)                 │
   │ 2. Schema Validator (Zod validation & normalization)    │
   │ 3. Automatic Rule-Based Fallback (Offline/deterministic) │
   └─────────────────────────────────────────────────────────┘
             │
             ▼
        ActionPlan (Normalized JSON Proposal)
             │
             ▼
       [Results UI] (Transparent reasoning, entities, actions, missing fields)
```

---

## Supported Intents

1. `expense_logged`: Completed transaction (e.g. *"I spent ₹250 on lunch today"*, *"I received a refund of ₹500 yesterday"*). Dispatches to `finance_agent` (`create_expense`).
2. `planned_expense`: Intended or upcoming expense. Dispatches to `finance_agent` (`create_planned_expense`).
3. `set_reminder`: General reminder with relative/absolute date & time. Dispatches to `reminder_agent` (`create_reminder`).
4. `bill_payment_reminder`: Utility/recurring bill payment. Multi-agent coordination: dispatches to both `reminder_agent` (`create_reminder`) and `finance_agent` (`create_planned_expense`).
5. `add_task`: Actionable task/todo item. Dispatches to `task_agent` (`create_task`).
6. `schedule_event`: Calendar event with date & time. Dispatches to `calendar_agent` (`schedule_event`).
7. `unknown`: Ambiguous, incomplete, or unrecognized input.

---

## Safety & Integrity Rules

- **Pending Payment Protection**: A notification or text stating a payment is pending (*"My payment of ₹1200 is pending"*) is **never** classified as a completed expense (`expense_logged` or `create_expense`).
- **No Hallucination**: Dates, times, amounts, and durations are never invented. Missing data is flagged in `missing_fields` and lowers confidence.
- **Model-Reported Confidence**: Confidence is explicitly labeled as *model-reported* and kept distinct from measured evaluation metrics.
- **Strict Schema Validation**: All LLM and rule outputs are validated at runtime against the Zod ActionPlan schema.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) or [npx](https://www.npmjs.com/package/npx)
- Android device or emulator with Expo Go / Expo development build

### 1. Installation

```bash
git clone <repo-url>
cd Life-OS
npm install
```

### 2. Configure the API Key

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Add your Google Gemini API key:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your_actual_gemini_api_key_here
EXPO_PUBLIC_LLM_MODEL=gemini-1.5-flash
```

> **Security Note**: In Phase 1 client prototyping, keys can be set via `.env` or using the in-app **⚙️ Configure Key** button. In production mobile applications, LLM calls **must** route through a secure backend proxy to prevent exposing API credentials on client devices.

If no API key is provided, the app continues to work with the **deterministic rule-based identifier** with zero degradation in offline capability.

### 3. Run the App

Start the Expo development server:

```bash
npm start
```

Press `a` to open on an Android emulator or scan the QR code using Expo Go on your physical Android phone.

### 4. Running Unit Tests

Run all unit tests using Jest:

```bash
npm test
```

---

## Component Status (Phase 1 — Step 2)

| Component | Status | Implementation Details |
|---|---|---|
| **Input Capture** | ✅ Implemented | Creates normalized `InputEvent` with unique `requestId`, ISO timestamp, and source metadata. |
| **Schema Validator** | ✅ Implemented | Runtime validation using Zod; validates intents, agents, ISO dates, dependencies, and formats. |
| **Rule-Based Identifier** | ✅ Implemented | Deterministic regex & keyword extraction, date/time resolution, multi-agent logic, safety guards. |
| **LLM-Based Identifier** | ✅ Implemented | Decoupled `GeminiProvider` behind `LlmProvider` interface, 1-retry self-correction, JSON schema prompt. |
| **Identifier Coordinator** | ✅ Implemented | Seamless fallback: tries LLM if configured; automatically falls back to rule-based engine on failure. |
| **Results UI** | ✅ Implemented | Complete 7-part ordered UI showing input, intent, confidence, entities, agents, actions, missing fields, and raw plan JSON. |
| **Supervisor Agent** | ⏳ Mock / Step 3 | Validation, dependency resolution, duplicate protection, and mock agent dispatch. |
| **Mock Agents** | ⏳ Mock / Step 3 | `ReminderAgent`, `FinanceAgent`, `TaskAgent`, `CalendarAgent` (mock returns only, no external APIs). |
| **SQLite History** | ⏳ Step 4 | Local persistence of past requests. |
| **Voice STT** | ⏳ Step 5 | Android speech-to-text. |
| **Simulated Notifications** | ⏳ Step 6 | Bank & bill alert simulation. |

