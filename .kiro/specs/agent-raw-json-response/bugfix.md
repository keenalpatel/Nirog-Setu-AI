# Bugfix Requirements Document

## Introduction

When a user reports symptoms in the Nirog-Setu AI chat interface — including potentially critical symptoms such as coughing blood — the agents are returning raw JSON output directly to the user instead of conversational, empathetic natural language. This occurs because the `emergency_agent.py` instruction explicitly requests JSON output format, and several API routes pass structured JSON payloads directly as the user-facing reply rather than extracting a human-readable message. The fix must ensure that all agent responses presented to the user are natural, conversational, and empathetic, while internal structured data remains an implementation detail never surfaced to the patient.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user describes symptoms that the triage or emergency agent classifies as critical (e.g., "I am coughing blood") THEN the system outputs a raw JSON block (containing fields like `emergency_type`, `ambulance_dispatched`, `nearest_hospital`, `alerts_sent`, `severity_confirmation`) directly in the chat window.

1.2 WHEN the `emergency_agent` produces a response THEN the system returns the agent's full JSON payload as the user-visible message, with no conversational wrapper or plain-language narration.

1.3 WHEN the triage agent determines a case is critical and hands off to the emergency agent THEN the system skips asking clarifying follow-up questions and immediately escalates, even if the reported symptom could have non-critical explanations (e.g., streaks of blood vs. massive hemoptysis).

1.4 WHEN any backend agent (diagnose, asha, prescribe) encounters an error or edge case THEN the system may expose raw JSON error objects or incomplete structured payloads to the user instead of a graceful plain-language message.

### Expected Behavior (Correct)

2.1 WHEN a user describes symptoms that trigger the critical/emergency path THEN the system SHALL respond in empathetic, conversational natural language — informing the user in plain terms that help has been dispatched, providing first-aid steps as readable prose, and reassuring the patient, without exposing any JSON fields.

2.2 WHEN the `emergency_agent` produces a structured response THEN the system SHALL extract the human-readable content from the response and present only conversational text to the user (e.g., "I've contacted emergency services. An ambulance is on the way. While you wait, please sit upright and remain calm...").

2.3 WHEN the triage agent identifies a potentially serious but ambiguous symptom (e.g., occasional blood-streaked cough alongside fever) THEN the system SHALL ask at least one clarifying follow-up question (e.g., frequency, quantity, accompanying symptoms) before escalating to the emergency agent, unless the symptom is unambiguously and immediately life-threatening.

2.4 WHEN any backend agent returns a structured response THEN the system SHALL always surface only the designated conversational reply field (or a synthesized plain-language equivalent) to the user, keeping all internal JSON fields (`confidence_score`, `icd_10_code`, `transfer_to`, `ambulance_dispatched`, etc.) as internal-only data.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the triage agent collects symptoms over 1–2 conversational turns THEN the system SHALL CONTINUE TO correctly route the case to the appropriate downstream agent (diagnose, prescribe, refer, emergency, asha) based on severity.

3.2 WHEN the triage API route receives a response from Vertex AI THEN the system SHALL CONTINUE TO parse the `conversational_reply` field from the structured JSON and return only that field as the user-facing `reply` in the API response.

3.3 WHEN a diagnosis is complete and urgency is HIGH or CRITICAL THEN the system SHALL CONTINUE TO trigger the multi-agent pipeline (prescribe, refer, asha, emergency as appropriate) and display the structured diagnostic card in the chat UI.

3.4 WHEN the user uploads a medical image or X-ray THEN the system SHALL CONTINUE TO process it through the multimodal triage pipeline and display the RAG trace log and diagnostic card output correctly.

3.5 WHEN the user writes in a non-English language (Hindi, Telugu, Marathi, Hinglish) THEN the system SHALL CONTINUE TO respond in the same language and script the user used, for all conversational messages.

3.6 WHEN the emergency API route is triggered for a CRITICAL case THEN the system SHALL CONTINUE TO generate and store the SOS ticket, ETA, and first-aid instructions internally so they can be rendered in the structured emergency card in the diagnostic report UI.
