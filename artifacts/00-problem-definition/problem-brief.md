# Problem brief

**Source:** `input/customer_data_cleaner_BRD.md`, draft v1.0, October 2026. **Status:** BRD-derived, not new research.

Operations analysts receive customer CSVs with inconsistent headers, formats, missing values, and duplicate identifiers. They need to inspect quality, map source fields, apply approved deterministic changes, validate records, understand exceptions, and preview eligible records before a human-authorized import.

**Product hypothesis:** Explainable profiling, reviewable mappings, lossless normalization, deterministic validation, and traceable exceptions can reduce avoidable preparation work while preventing silent data loss. This is a hypothesis pending research and pilot measurement.

**Scope boundary:** CSV onboarding; no cross-system entity resolution, autonomous ambiguous corrections, or configured import destination in this repository.
