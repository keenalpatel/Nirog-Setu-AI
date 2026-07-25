# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Emergency Agent Outputs Raw JSON Instead of Conversational Prose
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists across all three paths
  - **Scoped PBT Approach**: Scope the property to the three concrete failing cases for reproducibility:
    - Path A: emergency_agent instruction contains `OUTPUT FORMAT (JSON)` → agent emits raw JSON block
    - Path B: `POST /api/emergency` response body has no `reply` field (`emergencyData.reply` is `undefined`)
    - Path C: triage_agent transfers to emergency_agent on first turn for ambiguous CRITICAL symptom (e.g., "occasional blood in cough with fever") without asking a clarifying question
  - **Test A — Emergency Agent JSON Instruction Check**:
    - Read `adk-agents/agents/emergency_agent.py` and assert the instruction string contains `"OUTPUT FORMAT (JSON)"` on unfixed code
    - This confirms the root cause: Gemini follows this instruction and emits a JSON block
    - Counterexample to document: `emergency_agent.instruction.includes('OUTPUT FORMAT (JSON)') === true`
  - **Test B — Emergency API No Reply Field**:
    - Call `POST /api/emergency` with `{ patientName: "Test Patient", patientLang: "en", primaryDiagnosis: "Massive hemoptysis" }`
    - Assert that `response.reply` is `undefined` or absent
    - Counterexample to document: `emergencyData.reply === undefined`
  - **Test C — Triage Immediate Escalation for Ambiguous Symptom**:
    - Read `adk-agents/agents/triage_agent.py` and assert the instruction contains `"For CRITICAL symptoms, transfer immediately"` and does NOT contain `"UNAMBIGUOUS CRITICAL"` or `"AMBIGUOUS CRITICAL"` distinction
    - This confirms the root cause: no two-tier escalation policy exists
    - Counterexample to document: `triage_agent.instruction` has immediate transfer with no ambiguous/unambiguous distinction
  - Run all three sub-tests on UNFIXED code
  - **EXPECTED OUTCOME**: All three sub-tests FAIL (this is correct — it proves the bugs exist across all three paths)
  - Document counterexamples found to understand root cause before implementing the fix
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Emergency and Non-Ambiguous Flows Unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe UNFIXED code behavior for non-buggy inputs first
  - **Observe on UNFIXED code**:
    - Observe: `triage_agent` instruction contains `"Respond ONLY with conversational text. Do NOT output JSON."` — this guard already works for non-critical flows
    - Observe: `POST /api/emergency` response contains `emergency.sosTicketId` (matches `SOS-108-XXXXXX` pattern), `emergency.etaMinutes === 12`, `emergency.firstAidInstructions` is a non-empty array of 4 strings
    - Observe: `triage_agent` instruction still classifies CRITICAL/HIGH/MODERATE/LOW and routes correctly via orchestrator — routing logic is unchanged
    - Observe: language-matching directive in `triage_agent` instruction is present and intact
  - **Write property-based tests capturing observed behavior patterns from Preservation Requirements**:
    - **Preservation Test 1 — Emergency Card Data Shape**: For any valid emergency POST request, assert `response.emergency.sosTicketId` matches `/^SOS-108-\d{6}$/`, `response.emergency.etaMinutes` is a positive number, and `response.emergency.firstAidInstructions` is a non-empty array. This is the data the `diagnosis_card` SOS section reads — must remain intact after the fix.
    - **Preservation Test 2 — Triage JSON Guard Intact**: Assert that `triage_agent.instruction` still contains `"Respond ONLY with conversational text. Do NOT output JSON."` after the fix is applied. This preserves the existing guard that already works for non-critical flows.
    - **Preservation Test 3 — Routing Logic Preserved**: Assert that `triage_agent.instruction` still contains CRITICAL/HIGH/MODERATE/LOW severity classification language after the fix.
    - **Preservation Test 4 — Language Matching Preserved**: Assert that `triage_agent.instruction` still contains the `"LANGUAGE MATCHING"` or `"RULE #1"` directive after the fix.
  - Property-based testing generates many test cases for stronger guarantees: generate random valid emergency payloads and assert `emergency` card data shape is always preserved regardless of input variations
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS on unfixed code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix for agent raw JSON response bug (three-file change)

  - [ ] 3.1 Fix `adk-agents/agents/emergency_agent.py` — remove JSON output instruction, add conversational prose directive
    - Remove the entire `OUTPUT FORMAT (JSON):` block (last ~15 lines of the instruction string, from `"OUTPUT FORMAT (JSON):"` through the closing `}`)
    - Add language-matching directive: `"LANGUAGE: Detect the patient's language from context and respond in that exact language and script."`
    - Add conversational output directive replacing the JSON block:
      ```
      OUTPUT: Respond ONLY with conversational, empathetic prose. Do NOT output JSON or structured data.
      - Acknowledge their situation with empathy (1 sentence).
      - State that emergency services have been contacted and ambulance is en route (1 sentence).
      - Provide 3-4 first-aid steps as numbered plain-language instructions.
      - Close with a reassuring statement.
      Keep your response under 200 words.
      ```
    - Preserve the `FIRST AID GUIDELINES` section — it remains as reference material for generating prose
    - _Bug_Condition: isBugCondition(input) where input IS LlmAgentResponse AND input.content STARTS_WITH "{" AND input.content CONTAINS "emergency_type"_
    - _Expected_Behavior: emergency_agent response is conversational empathetic prose in patient's language, does NOT start with "{", does NOT contain "emergency_type" or "ambulance_dispatched" or "severity_confirmation"_
    - _Preservation: triage_agent routing, language matching, orchestrator handoff, and all non-emergency agent flows are unchanged_
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 3.2 Fix `app/api/emergency/route.ts` — add plain-language `reply` field to response body
    - After the `emergencyPayload` object is constructed (before the `console.warn` line), synthesize a `reply` string from the payload data without any additional AI call:
      ```typescript
      const reply = `Emergency services have been contacted. An ambulance (Ticket: ${emergencyPayload.sosTicketId}) is on its way — estimated arrival in ${emergencyPayload.etaMinutes} minutes. While you wait: ${emergencyPayload.firstAidInstructions.slice(0, 2).join(' ')} Stay calm and keep emergency contacts ready.`;
      ```
    - Update the `NextResponse.json(...)` return to include the new `reply` field:
      ```typescript
      return NextResponse.json({
        success: true,
        reply,
        emergency: emergencyPayload,
      });
      ```
    - Do NOT remove `emergency: emergencyPayload` — the chat UI's `runMultiAgentPipeline` reads `emergencyData.emergency` to populate the SOS card in the `diagnosis_card` message type
    - _Bug_Condition: isBugCondition(input) where input IS EmergencyApiResponse AND input.reply IS undefined OR null_
    - _Expected_Behavior: response contains non-empty `reply` string that references sosTicketId and etaMinutes; `emergency` card data object is preserved unchanged_
    - _Preservation: emergencyData.emergency shape (sosTicketId, etaMinutes, firstAidInstructions, patientInfo, status, serviceProvider) is identical before and after the fix_
    - _Requirements: 2.2, 2.4, 3.6_

  - [ ] 3.3 Fix `adk-agents/agents/triage_agent.py` — replace immediate CRITICAL transfer with two-tier escalation policy
    - Replace the current `COMPLETION` block (the last two lines of the instruction: `"Thank you. I'm now submitting..."` and `"For CRITICAL symptoms, transfer immediately to emergency_agent."`) with the two-tier escalation policy:
      ```
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
    - Keep the existing `"Respond ONLY with conversational text. Do NOT output JSON."` guardrail at the end — do not remove or modify it
    - No other changes to `triage_agent.py` — language matching, JSON output guard, and other clinical directives are already correct
    - _Bug_Condition: isBugCondition(input) where input IS TriageAgentInvocation AND input.symptomIsAmbiguousCritical AND input.clarifyingTurnsCompleted < 1 AND triageDecision IS "transfer_to_emergency_immediately"_
    - _Expected_Behavior: for ambiguous CRITICAL symptoms (blood-streaked cough, chest pain of uncertain type, high fever with uncertain consciousness), triage_agent asks exactly one clarifying question before routing; for unambiguous CRITICAL (unconscious, massive bleeding, confirmed cardiac arrest) triage_agent transfers immediately_
    - _Preservation: language matching, severity classification, non-critical routing (HIGH/MODERATE/LOW), JSON output guard, and multimodal image directive are all unchanged_
    - _Requirements: 2.3, 3.1, 3.5_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Emergency Agent Outputs Conversational Prose
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior across all three paths
    - Re-run Test A: assert `emergency_agent.instruction` does NOT contain `"OUTPUT FORMAT (JSON)"` → should PASS after fix
    - Re-run Test B: call `POST /api/emergency` and assert `response.reply` is a non-empty string containing the SOS ticket ID → should PASS after fix
    - Re-run Test C: assert `triage_agent.instruction` contains `"UNAMBIGUOUS CRITICAL"` and `"AMBIGUOUS CRITICAL"` → should PASS after fix
    - **EXPECTED OUTCOME**: All three sub-tests PASS (confirms all three bug paths are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Emergency and Non-Ambiguous Flows Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Re-run Preservation Test 1: assert `response.emergency` card data shape is still intact (`sosTicketId`, `etaMinutes`, `firstAidInstructions`)
    - Re-run Preservation Test 2: assert `triage_agent.instruction` still contains the `"Do NOT output JSON"` guard
    - Re-run Preservation Test 3: assert `triage_agent.instruction` still contains severity classification language
    - Re-run Preservation Test 4: assert `triage_agent.instruction` still contains the language-matching directive
    - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
    - Confirm all tests pass after fix with no regressions introduced

- [ ] 4. Checkpoint — Ensure all tests pass
  - Verify all four exploration sub-tests from task 3.4 pass (Property 1: Expected Behavior)
  - Verify all four preservation tests from task 3.5 pass (Property 2: Preservation)
  - Confirm `emergency_agent.py` instruction no longer contains `OUTPUT FORMAT (JSON)` and does contain the new conversational prose directive
  - Confirm `app/api/emergency/route.ts` response shape includes both `reply` (non-empty string) and `emergency` (card data object, unchanged)
  - Confirm `triage_agent.py` instruction contains the UNAMBIGUOUS CRITICAL / AMBIGUOUS CRITICAL two-tier escalation policy
  - Ensure all tests pass; ask the user if any questions arise about edge cases or language-matching behavior in the fixed emergency agent.
