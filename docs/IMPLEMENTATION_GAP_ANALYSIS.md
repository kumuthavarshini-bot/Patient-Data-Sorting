# Implementation Gap Analysis

The BRD is the scope authority. Existing planning documents and schema proposals do not silently become approved business policy.

| Requirement area | Baseline gap | Implemented in this increment | Remaining |
|---|---|---|---|
| Orchestration | Dashboard-only planning state; no executable handoffs | Local Node orchestrator chains actual parser/normalizer/validator functions and writes events/artifacts | Browser UI does not start or monitor CLI runs; retry/resume/cancel unsupported |
| Profile/mapping | Functions existed only in UI | Structured profile report, mapping proposal, explicit approval gate | Full schema and optional fields need business approval |
| Normalization/validation | Demo functions existed but no run contracts | Reuses same tested deterministic functions; count reconciliation and CSV artifacts | Does not implement dates/email validation or any unapproved business rules |
| Exception handling | UI-only output | Machine-readable register and CSV/Markdown exception reports | Human resolution workflow and reprocessing within run history are absent |
| Import | No destination/service contract | Import gate explicitly BLOCKED; no records imported | Destination, auth, idempotency, receipt, partial-failure policy required |
| UX orchestration | Seven planning phases are an interactive local checklist | Separate 10-stage UX evidence plan and artifact library | Automated agent execution is not claimed; evidence-generation tool integration is not present |
| Product pages | Dashboard and functional local demo only | Added a third UX outcomes/evidence-library page | A dedicated live pipeline execution/monitoring page remains; the dashboard checklist is still prototype state |
| Chatbot | Static approved deterministic Q&A | Preserved unchanged | LLM integration intentionally absent; none is configured |
| Evidence | No persistent run evidence | Local manifest, events, source fingerprint, reports, outputs | No access control/retention controls; run files may contain customer values |
| QA | Core behavior covered by Node tests | Added orchestration and handoff tests | Browser accessibility/responsive testing and deployment checks remain separate |

This increment deliberately does not represent the certification definition of done as complete. The orchestration is a local, deterministic implementation, not autonomous AI; the existing five agents execute documented code procedures without an external model.
