---
title: Submitting Pull Requests
sidebar_position: 3
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

# Submitting Pull Requests

Learn how to create and submit high-quality pull requests to Apache Superset.

## Before You Start

### Prerequisites
- [ ] Development environment is set up
- [ ] You've forked and cloned the repository
- [ ] You've read the [contributing overview](./overview)
- [ ] You've found or created an issue to work on

### PR Readiness Checklist
- [ ] Code follows [coding guidelines](../guidelines/design-guidelines)
- [ ] Tests are passing locally
- [ ] Linting passes (`pre-commit run --all-files`)
- [ ] Documentation is updated if needed

## Creating Your Pull Request

### 1. Create a Feature Branch

```bash
# Update your fork
git fetch upstream
git checkout master
git merge upstream/master
git push origin master

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

```bash
# Make changes
edit files...

# Run tests
pytest tests/unit_tests/
cd superset-frontend && npm run test

# Run linting
pre-commit run --all-files

# Commit with conventional format
git add .
git commit -m "feat(dashboard): add new filter component"
```

### 3. PR Title Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Reverting changes

**Scopes:**
- `dashboard`: Dashboard functionality
- `sqllab`: SQL Lab features
- `explore`: Chart explorer
- `chart`: Visualization components
- `api`: REST API endpoints
- `db`: Database connections
- `security`: Security features
- `config`: Configuration

**Examples:**
```
feat(sqllab): add query cost estimation
fix(dashboard): resolve filter cascading issue
docs(api): update REST endpoint documentation
refactor(explore): simplify chart controls logic
perf(dashboard): optimize chart loading
```

### 4. PR Description Template

Use the template from `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
### SUMMARY
Brief description of changes and motivation.

### BEFORE/AFTER SCREENSHOTS OR ANIMATED GIF
[Required for UI changes]

### TESTING INSTRUCTIONS
1. Step-by-step instructions
2. How to verify the fix/feature
3. Any specific test scenarios

### ADDITIONAL INFORMATION
- [ ] Has associated issue: #12345
- [ ] Required feature flags:
- [ ] API changes:
- [ ] DB migration required:

### CHECKLIST
- [ ] CI checks pass
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] PR title follows conventions
```

### 5. Submit the PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create PR via GitHub CLI
gh pr create --title "feat(sqllab): add query cost estimation" \
  --body-file .github/PULL_REQUEST_TEMPLATE.md

# Or use the GitHub web interface
```

## PR Best Practices

### Keep PRs Focused
- One feature/fix per PR
- Break large changes into smaller PRs
- Separate refactoring from feature changes

### Write Good Commit Messages
```bash
# Good
git commit -m "fix(dashboard): prevent duplicate API calls when filters change"

# Bad
git commit -m "fix bug"
git commit -m "updates"
```

### Include Tests
```python
# Backend test example
def test_new_feature():
    """Test that new feature works correctly."""
    result = new_feature_function()
    assert result == expected_value
```

```typescript
// Frontend test example
test('renders new component', () => {
  const { getByText } = render(<NewComponent />);
  expect(getByText('Expected Text')).toBeInTheDocument();
});
```

### Add Screenshots for UI Changes
```markdown
### Before
![Before](link-to-before-screenshot)

### After  
![After](link-to-after-screenshot)
```

### Update Documentation
- Update relevant docs in `/docs` directory
- Add docstrings to new functions/classes
- Update UPDATING.md for breaking changes

## CI Checks

### Required Checks
All PRs must pass:
- `Python Tests` - Backend unit/integration tests
- `Frontend Tests` - JavaScript/TypeScript tests
- `Linting` - Code style checks
- `Type Checking` - MyPy and TypeScript
- `License Check` - Apache license headers
- `Documentation Build` - Docs compile successfully

### Common CI Failures

#### Python Test Failures
```bash
# Run locally to debug
pytest tests/unit_tests/ -v
pytest tests/integration_tests/ -v
```

#### Frontend Test Failures
```bash
cd superset-frontend
npm run test -- --coverage
```

#### Linting Failures
```bash
# Auto-fix many issues
pre-commit run --all-files

# Manual fixes may be needed for:
# - MyPy type errors
# - Complex ESLint issues
# - License headers
```

## Responding to Reviews

### Address Feedback Promptly
```bash
# Make requested changes
edit files...

# Add commits (don't amend during review)
git add .
git commit -m "fix: address review feedback"
git push origin feature/your-feature-name
```

### Request Re-review
- Click "Re-request review" after addressing feedback
- Comment on resolved discussions
- Thank reviewers for their time

### Handling Conflicts
```bash
# Update your branch
git fetch upstream
git rebase upstream/master

# Resolve conflicts
edit conflicted files...
git add .
git rebase --continue

# Force push (only to your feature branch!)
git push --force-with-lease origin feature/your-feature-name
```

## After Merge

### Clean Up
```bash
# Delete local branch
git checkout master
git branch -d feature/your-feature-name

# Delete remote branch
git push origin --delete feature/your-feature-name

# Update your fork
git fetch upstream
git merge upstream/master
git push origin master
```

### Follow Up
- Monitor for any issues reported
- Help with documentation if needed
- Consider related improvements

## Tips for Success

### Do
- ✅ Keep PRs small and focused
- ✅ Write descriptive PR titles and descriptions
- ✅ Include tests for new functionality
- ✅ Respond to feedback constructively
- ✅ Update documentation
- ✅ Be patient with the review process

### Don't
- ❌ Submit PRs with failing tests
- ❌ Include unrelated changes
- ❌ Force push to master
- ❌ Ignore CI failures
- ❌ Skip the PR template

## Getting Help

- **Slack**: Ask in #development or #beginners
- **GitHub**: Tag @apache/superset-committers for attention
- **Mailing List**: dev@superset.apache.org

Next: [Understanding code review process](./code-review)
