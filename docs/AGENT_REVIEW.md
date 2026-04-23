# Agent Review Gate

The Codex skill `agent-review` is installed in `C:\Users\Brian\.codex\skills\agent-review`.

Invoke it with:

```text
Agent Review
```

Use it after large tasks and before important commits. The reviewer acts as a technical leader and reports blocking findings before summaries.

## Blocking Areas

- Correctness, auth, token grants, recording access, and data persistence.
- Database migration safety and rollback notes.
- Test coverage for changed contracts and user flows.
- Production readiness for 25 concurrent classes.
- Monitoring, backup/restore, AWS fallback, and incident response.

Large changes should not be considered done while Agent Review has blocking findings.
