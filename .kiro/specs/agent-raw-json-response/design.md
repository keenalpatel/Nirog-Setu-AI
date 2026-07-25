# Agent Raw JSON Response Bugfix Design

## Overview

Agents in the Nirog-Setu AI pipeline are leaking internal structured JSON directly into the patient-facing chat window. The `emergency_agent.py` instruction explicitly requests a JSON `OUTPUT FORMAT`, which means Gemini emits a raw JSON block that the ADK/orchestrator then surfaces verbatim. Simultaneously, `app/api/emergency/route.ts` returns only the raw `emergencyPayload` object with no conversational `reply` field, so the chat UI cannot extract human-readable text. A secondary issue exists in `triage_agent.py`: the instruction says to "transfer immediately" for CRITICAL symptoms, bypassing the 1–2 clarifying-question loop that could distinguish massive hemoptysis (truly critical) from occasional blood-streaked cough (moderate–high urgency).

The fix is:
1. Rewrite the `emergency_agent` instruction to emit conversational prose and move the structured fields to a separate internal extraction step.
2. Add a `reply` field to the `emergency/route.ts` response so the chat pipeline has a consistent extraction point.
3. Tighten the `triage_agent` instruction to require at least one clarifying follow-up before escalating ambiguous critical symptoms.
4. Confirm that `orchestrator.py` and the chat UI already handle conversational surfacing correctly (they do — no changes needed there).

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when the emergency agent or emergency API route produces output that reaches the chat UI without a conversational `reply` string, OR when triage escalates immediately to CRITICAL without a clarifying turn for ambiguous symptoms.
- **Property (P)**: The desired behavior — all user-visible messages are natural-language prose; no raw JSON fields are exposed; ambiguous CRITICAL triggers receive ≥1 clarifying question.
- **Preservation**: Existing multi-turn triage flow, structured diagnostic card rendering in the UI, multi-agent pipeline routing, language matching, and multimodal image handling must remain unchanged.
- **emergency_agent**: The `LlmAgent` defined in `adk-agents/agents/emergency_agent.py` that handles CRITICAL severity cases.
- **emergency/route.ts**: The Next.js API route at `app/api/emergency/route.ts` that is called from the chat UI's multi-agent pipeline when urgency is `critical`.
- **triage_agent**: The `LlmAgent` defined in `adk-agents/agents/triage_agent.py` that is the first point of contact for all patient messages.
- **conversational_reply**: The string field extracted from structured AI output that the chat UI surfaces as a chat bubble.
- **runMultiAgentPipeline**: The function in `app/chat/page.tsx` that calls prescribe, refer, asha, and emergency APIs in sequence, then renders the `diagnosis_card` message.
- **diagnosis_card**: The chat message type that renders structured data (SOS, prescriptions, referrals, ASHA alerts) as a rich UI card — separate from the conversational reply bubble.

---

## Bug Details

### Bug Condition

The bug manifests in three related but distinct trigger paths:

**Path A — emergency_agent emits raw JSON (ADK pipeline):**
The `emergency_agent` instruction contains an explicit `OUTPUT FORMAT (JSON)` block. When Gemini follows this instruction, the ADK orchestrator receives a raw JSON string as the agent's conversational reply and surfaces it verbatim in the chat.

**Path B — emergency/route.ts returns no conversational reply (Next.js pipeline):**
The `POST /api/emergency` handler returns `{ success: true, emergency: emergencyPayload }`. The chat UI's `runMultiAgentPipeline` reads `emergencyData.emergency` and renders it inside the `diagnosis_card`. However, if any code path tries to use `emergencyData.reply` as a chat bubble, it finds `undefined` and would either surface nothing or crash. The `emergencyPayload` object itself is never meant to be a chat bubble — it's card data. The bug is that no conversational `reply` string exists in the response, which makes the route inconsistent with the triage route's contract and creates risk of raw-JSON surfacing if the rendering path changes.

**Path C — triage_agent escalates CRITICAL immediately (no clarifying turn):**
The current instruction says "For CRITICAL symptoms, transfer immediately to emergency_agent." A user reporting "occasional blood-streaked cough with fever" might trigger this path even though the symptom is ambiguous. The spec (requirement 2.3) requires ≥1 clarifying question before escalation unless the symptom is unambiguously life-threatening.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input — one of:
    A) An LLM agent response from emergency_agent in the ADK pipeline
    B) A JSON response body from POST /api/emergency in the Next.js pipeline
    C) A triage_agent invocation with ambiguous CRITICAL-adjacent symptom input

  OUTPUT: boolean

  // Path A: emergency_agent emits JSON when it should emit conversational prose
  IF input IS LlmAgentResponse
    AND input.content STARTS_WITH "{"
    AND input.content CONTAINS "emergency_type"
    RETURN true

  // Path B: emergency API response has no conversational reply field
  IF input IS EmergencyApiResponse
    AND input.reply IS undefined OR null
    RETURN true

  // Path C: triage agent escalates without clarifying ambiguous critical symptom
  IF input IS TriageAgentInvocation
    AND input.symptomIsAmbiguousCritical(e.g., "blood-streaked cough")
    AND input.clarifyingTurnsCompleted < 1
    AND triageDecision IS "transfer_to_emergency_immediately"
    RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **Path A example**: User says "I am coughing blood." → `emergency_agent` responds with the raw JSON block `{"emergency_type": "Massive hemoptysis", "ambulance_dispatched": true, ...}` displayed as a chat bubble.
- **Path B example**: `runMultiAgentPipeline` calls `/api/emergency` and receives `{ success: true, emergency: { sosTicketId: "SOS-108-...", ... } }`. No `reply` field exists. If future code tries `emergencyData.reply`, it gets `undefined`.
- **Path C example**: User says "Mujhe thoda khoon aa raha hai khansi mein aur bukhar bhi hai" (occasional blood in cough with fever). Triage immediately transfers to emergency without asking frequency, quantity, or duration.
- **Non-buggy example**: User says "I have mild fever and sore throat." → Triage replies conversationally, collects 1–2 details, routes to diagnose. No JSON surfacing. (Must be preserved.)

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The triage API route (`/api/triage`) MUST continue to parse `conversational_reply` from the Vertex AI JSON response and return it as `reply` in the API response body. This is already correct and must not be altered.
- The chat UI's `runMultiAgentPipeline` MUST continue to call `/api/emergency` only when `urgency.toLowerCase() === 'critical'`, and MUST continue to render `emergencyData.emergency` inside the `diagnosis_card` (the SOS card section).
- The multi-agent routing in `orchestrator.py` MUST continue to transfer to `emergency_agent` for CRITICAL severity and to `diagnose_agent` for HIGH/MODERATE/LOW.
- Language matching (Hindi, Telugu, Marathi, Hinglish, English) MUST continue to work correctly across all agent responses.
- Multimodal image/X-ray upload processing MUST continue to work through the triage → diagnose pipeline.
- The structured `diagnosis_card` UI rendering (SOS block, ASHA block, referral block, prescription block) MUST continue to work using the structured data from the API responses — this data is never surfaced as raw text, only rendered as UI components.
- Triage completion after 1–2 conversational turns MUST continue to trigger the `runMultiAgentPipeline` via `triageData.isComplete === true`.

**Scope:**
All inputs that do NOT involve the emergency agent JSON output, the emergency API reply field, or ambiguous CRITICAL triage escalation should be completely unaffected by this fix. This includes:
- Normal symptom triage for LOW/MODERATE/HIGH cases
- Prescribe, diagnose, refer, and ASHA agent flows
- Image upload and multimodal analysis flows
- Any conversational turn where `isComplete` is `false`

---

## Hypothesized Root Cause

1. **Explicit JSON output instruction in emergency_agent**: The `instruction` string in `emergency_agent.py` ends with a section labeled `OUTPUT FORMAT (JSON):` followed by a JSON template. Gemini models follow this instruction faithfully, generating a JSON object as the response text. The ADK `LlmAgent` then treats this JSON string as the conversational reply and returns it to the orchestrator, which surfaces it in the chat. Fix: remove the JSON output block from the instruction and replace with a conversational prose directive, mirroring `triage_agent.py`'s `"Respond ONLY with conversational text. Do NOT output JSON."` guardrail.

2. **Missing `reply` field in emergency/route.ts**: The Next.js emergency route was designed purely as a data provider for the diagnostic card — it returns `emergencyPayload` as structured data. It was never given the responsibility of generating a conversational message. The `runMultiAgentPipeline` in `chat/page.tsx` only reads `emergencyData.emergency` for card rendering and never uses a `reply` field. However, the contract between API routes and the pipeline is now inconsistent: every other route (triage, diagnose, prescribe, refer, asha) returns a `reply` or has a clear conversational field. Fix: add a `reply` string to the emergency route response — a plain-language message synthesized from the payload — so the route is consistent and any future code path that looks for `reply` gets a proper string.

3. **Immediate CRITICAL transfer without clarifying turn in triage_agent**: The instruction explicitly says "For CRITICAL symptoms, transfer immediately to emergency_agent." This bypasses the 1–2 clarifying turn requirement for ambiguous cases. A user mentioning blood in cough could mean minor throat irritation (from a cold) or massive hemoptysis. Fix: add a conditional directive that distinguishes unambiguously life-threatening symptoms (unconscious patient, severe active bleeding, confirmed massive hemoptysis, known MI) from ambiguous CRITICAL-adjacent symptoms that require one clarifying question before escalation.

4. **No defensive strip in orchestrator.py** (secondary, lower priority): The orchestrator's instruction does not explicitly tell it to strip or ignore JSON from sub-agent replies before surfacing to the user. This is fine today because `triage_agent` already has the JSON guard, but `emergency_agent` lacks it. Once `emergency_agent`'s instruction is fixed, this is no longer an issue. No code change needed in `orchestrator.py`.

5. **Chat UI already handles the conversational pipeline correctly**: `chat/page.tsx` uses `triageData.reply` for all conversational bubbles and uses `emergencyData.emergency` only for card rendering. The UI is not a root cause. No change needed.

---

## Correctness Properties

Property 1: Bug Condition - Emergency Agent Outputs Conversational Prose

_For any_ patient input where the bug condition holds — specifically, an emergency agent activation (either via ADK or the Next.js `/api/emergency` route) OR a triage escalation of an ambiguous CRITICAL-adjacent symptom without a prior clarifying turn — the fixed system SHALL respond with empathetic, natural-language prose visible to the user, SHALL NOT expose any raw JSON fields (such as `emergency_type`, `ambulance_dispatched`, `severity_confirmation`) as user-visible text, and SHALL ensure at least one clarifying turn occurs before escalating ambiguous symptoms to CRITICAL.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Emergency and Non-Ambiguous Flows Unchanged

_For any_ input where the bug condition does NOT hold — i.e., normal triage flows (LOW/MODERATE/HIGH), diagnose/prescribe/refer/asha agent responses, image upload flows, language-matched replies, and `diagnosis_card` structured rendering — the fixed system SHALL produce exactly the same behavior as the original system, with all conversational replies, structured card data, routing decisions, and language matching preserved without regression.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

---

## Fix Implementation

### Changes Required

#### File 1: `adk-agents/agents/emergency_agent.py`

**Function/Section**: `emergency_agent.instruction`

**Problem**: The `OUTPUT FORMAT (JSON):` block at the end of the instruction causes Gemini to emit raw JSON as its conversational reply.

**Specific Changes**:

1. **Remove the entire `OUTPUT FORMAT (JSON):` section** (the last ~15 lines of the instruction string that define the JSON template).

2. **Add a conversational output directive** at the end of the instruction, matching the guardrail already present in `triage_agent.py`:
   ```
   Respond ONLY with conversational, empathetic text in the patient's language. Do NOT output JSON.
   Acknowledge the emergency warmly, provide first-aid steps as numbered plain-language instructions,
   and reassure the patient that help is on the way. Keep your response under 150 words.
   ```

3. **Add language-matching directive** since the emergency agent will now be patient-facing:
   ```
   LANGUAGE: Always respond in the exact same language and script the patient used in their last message.
   ```

4. **Preserve the FIRST AID GUIDELINES section** — this content is valuable and should remain as reference material for generating the prose response (just not as a JSON template).

**Before (end of instruction)**:
```python
OUTPUT FORMAT (JSON):
{
  "emergency_type": "description of emergency",
  "first_aid_instructions": "immediate steps in patient's language",
  "ambulance_dispatched": true/false,
  ...
  "severity_confirmation": "CRITICAL"
}
```

**After (end of instruction)**:
```python
LANGUAGE: Detect the patient's language from context and respond in that exact language and script.

OUTPUT: Respond ONLY with conversational, empathetic prose. Do NOT output JSON or structured data.
- Acknowledge their situation with empathy (1 sentence).
- State that emergency services have been contacted and ambulance is en route (1 sentence).
- Provide 3-4 first-aid steps as numbered plain-language instructions.
- Close with a reassuring statement.
Keep your response under 200 words.
```

---

#### File 2: `app/api/emergency/route.ts`

**Function**: `POST` handler

**Problem**: The response body has no `reply` field. The route returns only `{ success: true, emergency: emergencyPayload }`. While the chat UI currently only uses `emergencyData.emergency` for card rendering, this inconsistency creates risk and violates the implicit API contract shared by all other routes.

**Specific Changes**:

1. **Generate a plain-language `reply` string** from the payload data, synthesized in the route handler (no additional AI call needed — use the structured data already present):
   ```typescript
   const reply = `Emergency services have been contacted. An ambulance (Ticket: ${emergencyPayload.sosTicketId}) is on its way — estimated arrival in ${emergencyPayload.etaMinutes} minutes. While you wait: ${emergencyPayload.firstAidInstructions.join(' ')}`;
   ```

2. **Add `reply` to the returned JSON**:
   ```typescript
   return NextResponse.json({
     success: true,
     reply,           // NEW — conversational plain-language message
     emergency: emergencyPayload,
   });
   ```

3. **Do not remove `emergency: emergencyPayload`** — the chat UI's `runMultiAgentPipeline` reads `emergencyData.emergency` to populate the SOS card in the `diagnosis_card` message type. Removing it would break the card rendering (requirement 3.6).

---

#### File 3: `adk-agents/agents/triage_agent.py`

**Function/Section**: `triage_agent.instruction`

**Problem**: The instruction says "For CRITICAL symptoms, transfer immediately to emergency_agent." This bypasses the clarifying question requirement for ambiguous symptoms.

**Specific Changes**:

1. **Replace the current COMPLETION block** with a two-tier escalation policy:

**Before**:
```python
COMPLETION: When you have enough symptom info (1-2 turns), say:
"Thank you. I'm now submitting your case to our diagnosis team for evaluation..."
For CRITICAL symptoms, transfer immediately to emergency_agent.
```

**After**:
```python
ESCALATION POLICY:
- UNAMBIGUOUS CRITICAL (transfer immediately, no clarifying turn required):
  Unconscious or unresponsive patient, confirmed massive active bleeding (not streaks),
  severe breathing difficulty with cyanosis, known cardiac arrest, severe trauma with
  major blood loss, snakebite with systemic symptoms, seizure currently in progress.

- AMBIGUOUS CRITICAL (ask exactly ONE clarifying question before transferring):
  Blood in cough or sputum — ask: "How much blood? A few streaks, or coughing up a
  significant amount?" Then transfer to emergency_agent if severe, or diagnose_agent if mild.
  Chest pain — ask: "Is the pain crushing or pressure-like, and does it radiate to your arm
  or jaw?" Then route accordingly.
  High fever with altered consciousness — ask: "Is the patient conscious and responding?"

COMPLETION: When you have enough symptom info (1-2 turns for non-critical, 1 clarifying turn
for ambiguous critical), say:
"Thank you. I'm now submitting your case to our team for evaluation..."
```

2. **No other changes to `triage_agent.py`** — language matching, JSON output guard, and clinical directives are already correct.

---

#### Files NOT requiring changes

- **`adk-agents/agents/orchestrator.py`**: Routing rules are correct. The orchestrator already has the right handoff logic. The issue was upstream (agent instruction), not in routing.
- **`app/chat/page.tsx`**: The UI correctly uses `triageData.reply` for conversational bubbles and `emergencyData.emergency` for card data. No change needed.
- **`app/api/triage/route.ts`**: Already extracts `conversational_reply` and returns it as `reply`. Correct.
- **`adk-agents/agents/diagnose_agent.py`**, **`prescribe_agent.py`**, **`refer_agent.py`**, **`asha_agent.py`**: These routes and agents have appropriate output handling already.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (exploratory), then verify the fix works correctly and preserves existing behavior (fix checking + preservation checking).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the emergency agent being invoked with a CRITICAL symptom input and assert that the response is conversational prose, not a JSON object. Also simulate the emergency API route being called and assert that a `reply` field is present. Run these on UNFIXED code to observe the failures.

**Test Cases**:
1. **Emergency Agent JSON Output Test**: Invoke `emergency_agent` with "Patient is coughing large amounts of blood and struggling to breathe." Assert that the response text does NOT start with `{` and does NOT contain the string `"emergency_type"`. *(Will fail on unfixed code — agent returns JSON.)*
2. **Emergency API Reply Field Test**: Call `POST /api/emergency` with a valid payload. Assert that the response JSON contains a `reply` string field that is non-empty. *(Will fail on unfixed code — no `reply` field exists.)*
3. **Triage Ambiguous CRITICAL Escalation Test**: Send "I have occasional blood in my cough and some fever" to `triage_agent`. Assert that the agent asks at least one clarifying question before emitting a transfer signal. *(Will fail on unfixed code — immediate transfer.)*
4. **Triage Unambiguous CRITICAL Test**: Send "Patient is unconscious and not breathing" to `triage_agent`. Assert that the agent transfers immediately without asking clarifying questions. *(Should pass even on unfixed code — preserve this behavior.)*

**Expected Counterexamples**:
- Test 1: `emergency_agent` response begins with `{` — JSON block confirmed.
- Test 2: `emergencyData.reply` is `undefined` — no conversational field confirmed.
- Test 3: `triage_agent` emits `transfer_to: "emergency_agent"` on the first turn without asking a follow-up question.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed system produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedSystem(input)
  ASSERT result.conversationalReply IS non-empty string
  ASSERT result.conversationalReply DOES NOT match /^\s*\{/   // no leading JSON brace
  ASSERT result.conversationalReply DOES NOT contain "emergency_type"
  ASSERT result.conversationalReply DOES NOT contain "ambulance_dispatched"
  ASSERT result.conversationalReply DOES NOT contain "severity_confirmation"
  IF input.type == "ambiguousCritical"
    ASSERT result.clarifyingQuestionAsked == true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed system produces the same result as the original system.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  originalResult := originalSystem(input)
  fixedResult := fixedSystem(input)
  ASSERT fixedResult.triageReply == originalResult.triageReply
  ASSERT fixedResult.isComplete == originalResult.isComplete
  ASSERT fixedResult.emergencyCardData == originalResult.emergencyCardData
  ASSERT fixedResult.routingDecision == originalResult.routingDecision
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (varied symptom descriptions, languages, image inputs)
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that routing, card rendering, and conversational reply extraction are unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for normal (non-CRITICAL) triage flows, image uploads, and structured card rendering; then write property-based tests capturing that behavior, then verify after applying the fix.

**Test Cases**:
1. **Normal Triage Preservation**: For LOW/MODERATE/HIGH inputs, verify `triage_agent` reply is conversational and `isComplete` triggers correctly after 1–2 turns. Verify same output before and after fix.
2. **Emergency Card Data Preservation**: Verify that after the fix, `emergencyData.emergency` still contains `sosTicketId`, `etaMinutes`, and `firstAidInstructions` — required for `diagnosis_card` SOS section rendering.
3. **Language Match Preservation**: Verify that Hindi, Hinglish, and Telugu inputs still receive language-matched replies from the fixed `triage_agent` and `emergency_agent`.
4. **Routing Decision Preservation**: Verify that CRITICAL severity still routes to `emergency_agent` and HIGH/MODERATE/LOW routes to `diagnose_agent` in the orchestrator after the fix.

### Unit Tests

- Test that `emergency_agent` instruction does not contain the string `OUTPUT FORMAT (JSON)` after the fix.
- Test `POST /api/emergency` response shape: assert `reply` is a non-empty string, `emergency.sosTicketId` matches expected format, `emergency.firstAidInstructions` is a non-empty array.
- Test `triage_agent` instruction contains the ambiguous/unambiguous CRITICAL distinction language.
- Test that for a given CRITICAL payload, `emergency/route.ts` synthesizes a `reply` that includes the SOS ticket ID and ETA.

### Property-Based Tests

- Generate random symptom strings across a clinically plausible space and assert that `emergency_agent` responses never start with `{` (no JSON leakage).
- Generate random urgency levels and assert that `emergency/route.ts` always returns a non-empty `reply` string regardless of input variations.
- Generate random non-critical symptom inputs and assert that `triage_agent` never transfers immediately without at least the configured number of turns.
- Generate random ambiguous critical symptoms and assert that `triage_agent` asks a clarifying question on the first turn.

### Integration Tests

- Full chat flow: User says "I have been coughing up blood constantly for the past hour" → verify no JSON appears in chat bubble → verify SOS card renders correctly in `diagnosis_card` → verify `reply` field is present in emergency API response.
- Ambiguous critical flow: User says "thoda sa khoon aa raha hai khansi mein" (a little blood in cough) → verify triage asks a clarifying question → user answers "bahut kam, sirf ek do baar" (very little, only once or twice) → verify routes to `diagnose_agent` not `emergency_agent`.
- Language preservation: User writes in Hindi throughout a CRITICAL flow → verify `emergency_agent` (ADK) and all conversational bubbles remain in Hindi.
- Card data integrity: Trigger a CRITICAL flow end-to-end → verify the `diagnosis_card` SOS section renders `sosTicketId`, `etaMinutes`, and first-aid steps correctly after the `emergency/route.ts` change.
