---
title: Issue Reporting
sidebar_position: 5
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

# Issue Reporting

Learn how to effectively report bugs and request features for Apache Superset.

## Before Opening an Issue

### Pre-Issue Checklist

1. **Search Existing Issues**
   ```
   Search: https://github.com/apache/superset/issues
   - Use keywords from your error message
   - Check both open and closed issues
   - Look for similar problems
   ```

2. **Check Documentation**
   - [User Documentation](https://superset.apache.org/docs/intro)
   - [FAQ](https://superset.apache.org/docs/frequently-asked-questions)
   - [Configuration Guide](https://superset.apache.org/docs/configuration/configuring-superset)

3. **Verify Version**
   ```bash
   # Check Superset version
   superset version

   # Try latest version
   pip install --upgrade apache-superset
   ```

4. **Reproduce Consistently**
   - Can you reproduce the issue?
   - Does it happen every time?
   - What specific actions trigger it?

## Bug Reports

### Bug Report Template

```markdown
### Bug Description
A clear and concise description of the bug.

### How to Reproduce
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

### Expected Behavior
What you expected to happen.

### Actual Behavior
What actually happened. Include error messages.

### Screenshots/Videos
If applicable, add screenshots or recordings.

### Environment
- Superset version: [e.g., 3.0.0]
- Python version: [e.g., 3.9.7]
- Node version: [e.g., 18.17.0]
- Database: [e.g., PostgreSQL 14]
- Browser: [e.g., Chrome 120]
- OS: [e.g., Ubuntu 22.04]

### Additional Context
- Using Docker: Yes/No
- Configuration overrides:
- Feature flags enabled:
- Authentication method:
```

### What Makes a Good Bug Report

#### ✅ Good Example
```markdown
### Bug Description
When filtering a dashboard with a date range filter, charts using
SQL Lab datasets don't update, while charts using regular datasets do.

### How to Reproduce
1. Create a dashboard with 2 charts:
   - Chart A: Uses a SQL Lab virtual dataset
   - Chart B: Uses a regular table dataset
2. Add a date range filter (last 30 days)
3. Apply the filter
4. Chart B updates, Chart A shows no change

### Expected Behavior
Both charts should filter to show last 30 days of data.

### Actual Behavior
Only Chart B updates. Chart A still shows all data.
No error messages in browser console or server logs.

### Screenshots
[Dashboard before filter]: attachment1.png
[Dashboard after filter]: attachment2.png
[Network tab showing requests]: attachment3.png

### Environment
- Superset version: 3.0.0
- Python version: 3.9.16
- Database: PostgreSQL 14.9
- Browser: Chrome 120.0.6099.71
- OS: macOS 14.2
```

#### ❌ Poor Example
```markdown
Dashboard filters don't work. Please fix.
```

### Required Information

#### Error Messages
```python
# Include full error traceback
Traceback (most recent call last):
  File "...", line X, in function
    error details
SupersetException: Detailed error message
```

#### Logs
```bash
# Backend logs
docker logs superset_app 2>&1 | tail -100

# Or from development
tail -f ~/.superset/superset.log
```

#### Browser Console
```javascript
// Include JavaScript errors
// Chrome: F12 → Console tab
// Include network errors
// Chrome: F12 → Network tab
```

#### Configuration
```python
# Relevant config from superset_config.py
FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": True,
    # ... other flags
}
```

## Feature Requests

### Feature Request Template

```markdown
### Is your feature request related to a problem?
A clear description of the problem you're trying to solve.

### Describe the solution you'd like
A clear description of what you want to happen.

### Describe alternatives you've considered
Other solutions or features you've considered.

### Additional context
Any other context, mockups, or examples.

### Are you willing to contribute?
- [ ] Yes, I can implement this feature
- [ ] Yes, I can help test
- [ ] No, but I can provide feedback
```

### Good Feature Requests Include

1. **Clear Use Case**
   ```markdown
   As a [type of user], I want [feature] so that [benefit].

   Example:
   As a data analyst, I want to schedule dashboard screenshots
   so that I can automatically send reports to stakeholders.
   ```

2. **Mockups/Designs**
   - UI mockups
   - Workflow diagrams
   - API specifications

3. **Impact Analysis**
   - Who benefits?
   - How many users affected?
   - Performance implications?

## Security Issues

### 🔴 IMPORTANT: Security Vulnerabilities

**DO NOT** create public issues for security vulnerabilities!

Instead:
1. Email: security@apache.org
2. Subject: `[Superset] Security Vulnerability`
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Security Issue Template

```markdown
Send to: security@apache.org

### Vulnerability Description
[Describe the security issue]

### Type
- [ ] SQL Injection
- [ ] XSS
- [ ] CSRF
- [ ] Authentication Bypass
- [ ] Information Disclosure
- [ ] Other: [specify]

### Affected Versions
[List affected versions]

### Steps to Reproduce
[Detailed steps - be specific]

### Impact
[What can an attacker do?]

### Suggested Fix
[If you have suggestions]
```

## Issue Labels

### Priority Labels
- `P0`: Critical - System unusable
- `P1`: High - Major feature broken
- `P2`: Medium - Important but workaround exists
- `P3`: Low - Nice to have

### Type Labels
- `bug`: Something isn't working
- `feature`: New feature request
- `enhancement`: Improvement to existing feature
- `documentation`: Documentation improvements
- `question`: Question about usage

### Component Labels
- `dashboard`: Dashboard functionality
- `sqllab`: SQL Lab
- `explore`: Chart builder
- `visualization`: Chart types
- `api`: REST API
- `security`: Security related

### Status Labels
- `needs-triage`: Awaiting review
- `confirmed`: Bug confirmed
- `in-progress`: Being worked on
- `blocked`: Blocked by dependency
- `stale`: No activity for 30+ days

## Issue Lifecycle

### 1. Creation
- User creates issue with template
- Auto-labeled as `needs-triage`

### 2. Triage
- Maintainer reviews within 7 days
- Labels applied (priority, type, component)
- Questions asked if needed

### 3. Confirmation
- Bug reproduced or feature discussed
- Label changed to `confirmed`
- Assigned to milestone if applicable

### 4. Development
- Contributor claims issue
- Label changed to `in-progress`
- PR linked to issue

### 5. Resolution
- PR merged
- Issue auto-closed
- Or manually closed with explanation

## Following Up

### If No Response

After 7 days without response:
```markdown
@apache/superset-committers This issue hasn't been triaged yet.
Could someone please take a look?
```

### Providing Updates

```markdown
Update: I found that this only happens when [condition].
Here's additional debugging information: [details]
```

### Issue Staleness

- Bot marks stale after 30 days of inactivity
- Closes after 7 more days without activity
- To keep open: Comment with updates

## Tips for Success

### Do's
- ✅ Search before creating
- ✅ Use templates
- ✅ Provide complete information
- ✅ Include screenshots/videos
- ✅ Be responsive to questions
- ✅ Test with latest version
- ✅ One issue per report

### Don'ts
- ❌ "+1" or "me too" comments (use reactions)
- ❌ Multiple issues in one report
- ❌ Vague descriptions
- ❌ Screenshots of text (copy/paste instead)
- ❌ Private/sensitive data in reports
- ❌ Demanding immediate fixes

## Useful Commands

### Gathering System Info

```bash
# Full environment info
python -c "
import sys
import superset
import sqlalchemy
import pandas
import numpy

print(f'Python: {sys.version}')
print(f'Superset: {superset.__version__}')
print(f'SQLAlchemy: {sqlalchemy.__version__}')
print(f'Pandas: {pandas.__version__}')
print(f'NumPy: {numpy.__version__}')
"

# Database versions
superset shell
>>> from superset import db
>>> print(db.engine.dialect.server_version_info)
```

### Creating Minimal Reproductions

```python
# Create test script
# minimal_repro.py
from superset import create_app

app = create_app()
with app.app_context():
    # Your reproduction code here
    pass
```

## Getting Help

### Before Creating an Issue

1. **Slack**: Ask in #troubleshooting
2. **GitHub Discussions**: Search/ask questions
3. **Stack Overflow**: Tag `apache-superset`
4. **Mailing List**: user@superset.apache.org

### Issue Not a Bug?

Consider:
- **Feature Request**: Use feature request template
- **Question**: Use GitHub Discussions
- **Configuration Help**: Ask in Slack
- **Development Help**: See [Contributing Guide](./overview)

Next: [Understanding the release process](./release-process)
