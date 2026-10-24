# Design decisions

| Problem | Evidence or hypothesis | Decision | Trade-off | Evaluation |
|---|---|---|---|---|
| Uncertain mappings can corrupt data | BRD BR-06 | Require explicit approval before dependent processing | Adds a review step | Implemented in CLI; not user-tested |
| Invalid rows must not disappear | BRD §§6, 8 | Preserve all rows; separate eligibility and exception exports | Larger local output | Covered by automated synthetic tests |
| Import destination is undefined | Repository/BRD open question | Block import and report `READY_FOR_REVIEW` | No end-to-end live import | Pending business decision |
| Sensitive source values should not leak into evidence logs | Privacy constraint | Manifest stores fingerprint/counts; local CSV outputs retain values | Local run folder still sensitive | Retention controls absent |
