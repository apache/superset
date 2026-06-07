# Demo IssueOps backlog

Issue definitions for the Cognition/Devin take-home demo on branch `devin-demo-target-v2`.

## Create issues on GitHub

```bash
gh auth login
./scripts/create-demo-issues.sh
```

Issues are created **without** the `devin-remediate` label. Add that label manually during the Loom to trigger automation.

## Files

Each `*.issue.md` file contains YAML frontmatter (`title`, `labels`) and the issue body.
