---
title: Code Review Process
sidebar_position: 4
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Code Review Process

Understand how code reviews work in Apache Superset and how to participate effectively.

## Overview

Code review is a critical part of maintaining code quality and sharing knowledge across the team. Every change to Superset goes through peer review before merging.

## For Authors

### Preparing for Review

#### Before Requesting Review
- [ ] Self-review your changes
- [ ] Ensure CI checks pass
- [ ] Add comprehensive tests
- [ ] Update documentation
- [ ] Fill out PR template completely
- [ ] Add screenshots for UI changes

#### Self-Review Checklist
```bash
# View your changes
git diff upstream/master

# Check for common issues:
# - Commented out code
# - Debug statements (console.log, print)
# - TODO comments that should be addressed
# - Hardcoded values that should be configurable
# - Missing error handling
# - Performance implications
```

### Requesting Review

#### Auto-Assignment
GitHub will automatically request reviews based on CODEOWNERS file.

#### Manual Assignment
For specific expertise, request additional reviewers:
- Frontend changes: Tag frontend experts
- Backend changes: Tag backend experts
- Security changes: Tag security team
- Database changes: Tag database experts

#### Review Request Message
```markdown
@reviewer This PR implements [feature]. Could you please review:
1. The approach taken in [file]
2. Performance implications of [change]
3. Security considerations for [feature]

Thanks!
```

### Responding to Feedback

#### Best Practices
- **Be receptive**: Reviews improve code quality
- **Ask questions**: Clarify if feedback is unclear
- **Explain decisions**: Share context for your choices
- **Update promptly**: Address feedback in timely manner

#### Comment Responses
```markdown
# Acknowledging
"Good catch! Fixed in [commit hash]"

# Explaining
"I chose this approach because [reason]. Would you prefer [alternative]?"

# Questioning
"Could you elaborate on [concern]? I'm not sure I understand the issue."

# Disagreeing respectfully
"I see your point, but I think [current approach] because [reason]. What do you think?"
```

## For Reviewers

### Review Responsibilities

#### What to Review
1. **Correctness**: Does the code do what it claims?
2. **Design**: Is the approach appropriate?
3. **Clarity**: Is the code readable and maintainable?
4. **Testing**: Are tests comprehensive?
5. **Performance**: Any performance concerns?
6. **Security**: Any security issues?
7. **Documentation**: Is it well documented?

### Review Checklist

#### Functionality
- [ ] Feature works as described
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] Backwards compatibility maintained

#### Code Quality
- [ ] Follows project conventions
- [ ] No code duplication
- [ ] Clear variable/function names
- [ ] Appropriate abstraction levels
- [ ] SOLID principles followed

#### Testing
- [ ] Unit tests for business logic
- [ ] Integration tests for APIs
- [ ] E2E tests for critical paths
- [ ] Tests are maintainable
- [ ] Good test coverage

#### Security
- [ ] Input validation
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Authentication/authorization checks
- [ ] No sensitive data in logs

#### Performance
- [ ] Database queries optimized
- [ ] No N+1 queries
- [ ] Appropriate caching
- [ ] Frontend bundle size impact
- [ ] Memory usage considerations

### Providing Feedback

#### Effective Comments

```python
# ✅ Good: Specific and actionable
"This query could cause N+1 problems. Consider using
`select_related('user')` to fetch users in a single query."

# ❌ Bad: Vague
"This doesn't look right."
```

```typescript
// ✅ Good: Suggests improvement
"Consider using useMemo here to prevent unnecessary
re-renders when dependencies haven't changed."

// ❌ Bad: Just criticism
"This is inefficient."
```

#### Comment Types

**Use GitHub's comment types:**
- **Comment**: General feedback or questions
- **Approve**: Changes look good
- **Request Changes**: Must be addressed before merge

**Prefix conventions:**
- `nit:` Minor issue (non-blocking)
- `suggestion:` Recommended improvement
- `question:` Seeking clarification
- `blocker:` Must be fixed
- `praise:` Highlighting good work

#### Examples

```markdown
nit: Consider renaming `getData` to `fetchUserData` for clarity

suggestion: This could be simplified using Array.reduce()

question: Is this intentionally not handling the error case?

blocker: This SQL is vulnerable to injection. Please use parameterized queries.

praise: Excellent test coverage! 👍
```

## Review Process

### Timeline

#### Expected Response Times
- **Initial review**: Within 2-3 business days
- **Follow-up review**: Within 1-2 business days
- **Critical fixes**: ASAP (tag in Slack)

#### Escalation
If no response after 3 days:
1. Ping reviewer in PR comments
2. Ask in #development Slack channel
3. Tag @apache/superset-committers

### Approval Requirements

#### Minimum Requirements
- **1 approval** from a committer for minor changes
- **2 approvals** for significant features
- **3 approvals** for breaking changes

#### Special Cases
- **Security changes**: Require security team review
- **API changes**: Require API team review
- **Database migrations**: Require database expert review
- **UI/UX changes**: Require design review

### Merge Process

#### Who Can Merge
- Committers with write access
- After all requirements met
- CI checks must pass

#### Merge Methods
- **Squash and merge**: Default for feature PRs
- **Rebase and merge**: For clean history
- **Create merge commit**: Rarely used

#### Merge Checklist
- [ ] All CI checks green
- [ ] Required approvals obtained
- [ ] No unresolved conversations
- [ ] PR title follows conventions
- [ ] Milestone set (if applicable)

## Review Etiquette

### Do's
- ✅ Be kind and constructive
- ✅ Acknowledge time and effort
- ✅ Provide specific examples
- ✅ Suggest solutions
- ✅ Praise good work
- ✅ Consider cultural differences
- ✅ Focus on the code, not the person

### Don'ts
- ❌ Use harsh or dismissive language
- ❌ Bikeshed on minor preferences
- ❌ Review when tired or frustrated
- ❌ Make personal attacks
- ❌ Ignore the PR description
- ❌ Demand perfection

## Becoming a Reviewer

### Path to Reviewer
1. **Contribute regularly**: Submit quality PRs
2. **Participate in discussions**: Share knowledge
3. **Review others' code**: Start with comments
4. **Build expertise**: Focus on specific areas
5. **Get nominated**: By existing committers

### Reviewer Expectations
- Review PRs in your area of expertise
- Respond within reasonable time
- Mentor new contributors
- Maintain high standards
- Stay current with best practices

## Advanced Topics

### Reviewing Large PRs

#### Strategy
1. **Request splitting**: Ask to break into smaller PRs
2. **Review in phases**:
   - Architecture/approach first
   - Implementation details second
   - Tests and docs last
3. **Use draft reviews**: Save comments and submit together

### Cross-Team Reviews

#### When Needed
- Changes affecting multiple teams
- Shared components/libraries
- API contract changes
- Database schema changes

### Performance Reviews

#### Tools
```python
# Backend performance
import cProfile
import pstats

# Profile the code
cProfile.run('function_to_profile()', 'stats.prof')
stats = pstats.Stats('stats.prof')
stats.sort_stats('cumulative').print_stats(10)
```

```typescript
// Frontend performance
// Use React DevTools Profiler
// Chrome DevTools Performance tab
// Lighthouse audits
```

## Resources

### Internal
- [Coding Guidelines](../guidelines/design-guidelines)
- [Testing Guide](../testing/overview)
- [Extension Architecture](../extensions/architecture)

### External
- [Google's Code Review Guide](https://google.github.io/eng-practices/review/)
- [Best Practices for Code Review](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/)
- [The Art of Readable Code](https://www.oreilly.com/library/view/the-art-of/9781449318482/)

Next: [Reporting issues effectively](./issue-reporting)
