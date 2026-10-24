# Agent, skill, artifact, and feature traceability

| Workflow stage | Agent / source | Skill | Input | Execution function | Output artifact | Gate | Test evidence | Product feature |
|---|---|---|---|---|---|---|---|---|
| Upload | Orchestrator phase `upload` | `skills/csv-intake.md` | Local CSV path | `demo-core.parseCsv` | Input fingerprint/row metadata in manifest | Valid UTF-8 CSV, headers, at least one data row | `tests/data-processor.test.js`; `tests/orchestrator.test.js` | Live Demo and CLI |
| Profile | `orchestration/agents/profile.agent.json` | `skills/data-profiling.md` | Parsed headers/rows | `profileDataset` | `agent-results/profile-report.json`; `artifacts/profile-report.md` | Counts generated from parsed dataset | `tests/orchestrator.test.js` | Profile report |
| Mapping | `orchestration/agents/mapping.agent.json` | `skills/field-mapping.md` | Headers and profile | `proposeMappings` | `agent-results/mapping-proposal.json` | Exact recognized mapping and explicit `--approve-mappings` | Mapping/gate tests | Mapping approval |
| Normalization | `orchestration/agents/normalization.agent.json` | `skills/data-normalization.md` | Original rows, approved Customer ID map | `demo-core.processRows` | `artifacts/normalized-records.csv`; normalization JSON | Mapping approved; original rows retained | `tests/data-processor.test.js`, orchestration test | Safe normalized export |
| Validation | `orchestration/agents/validation.agent.json` | `skills/deterministic-validation.md` | Normalized records | `demo-core.processRows` deterministic BR-01/BR-02 | `validation/validation-report.json`; `artifacts/validated-records.csv` | Eligible + invalid equals input | Processor and orchestration tests | Eligibility and result tables |
| Exceptions | `orchestration/agents/exception.agent.json` | `skills/exception-management.md` | Invalid records and all error codes | Exception artifact writer | `agent-results/exception-register.json`; `artifacts/exceptions.csv`; Markdown report | All invalid rows represented | Orchestration count test | Exception report |
| Import | No destination agent/service configured | `skills/import-safety.md` | Eligible preview only | Not implemented | Import phase event `BLOCKED` | Destination contract and human approval missing | Asserted blocked status in orchestration test | No import claim |

Runtime manifest records input SHA-256, versions, skill/instruction hashes, output references, statuses, and counts. Current tests use synthetic data. An actual run ID is generated and stored at execution time; run artifacts are excluded from source control.

## UX workflow distinction

The 10 UX/product discovery and design stages are documented in `artifacts/00-*` through `artifacts/06-*`. They are not the dashboard's existing seven product-planning checklist phases and are not the seven CSV-processing phases above. UX stage documents are evidence-labeled plans/templates; no research or usability agent was executed.
