# Mobile money simulator adapter

Implements the rail adapter interface for sandbox:

```text
quote(intent) → Quote
execute(authorisedIntent) → ExecutionResult
status(executionId) → Status
```

Always succeeds after a short delay unless instructed to fail for chaos tests.
No real telco connectivity.
