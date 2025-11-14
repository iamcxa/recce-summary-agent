---
name: tldr
description: Generate a brief summary (TL;DR) of the PR
---

When this command is used, generate a very concise summary of the pull request changes:

## TL;DR Format

Provide a 2-3 sentence summary that captures:
1. **What changed**: The primary changes in this PR
2. **Why it matters**: The key impact or benefit
3. **Action needed**: Any important notes for reviewers or users

Keep it brief and focused on the most critical information. Use bullet points if listing multiple key changes.

Example output:
```
## TL;DR
- Refactored authentication middleware to use JWT tokens instead of sessions
- Improves API performance by 30% and enables stateless scaling
- **Breaking change**: Clients must update to send Authorization headers
```
