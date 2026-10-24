# Task flow and decision points

```text
Upload → parse/profile → propose mapping → human mapping approval
     → deterministic normalization → deterministic validation
        ↙ invalid/review rows → exception report → correction/revalidation
        ↘ eligible rows → preview → explicit human import approval → configured destination
```

The import branch is not executable without a destination contract. Ambiguous mappings must pause; invalid rows are never eligible.
