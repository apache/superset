---
title: Release Process
sidebar_position: 6
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

# Release Process

Understand Apache Superset's release process, versioning strategy, and how to participate.

## Release Cadence

### Schedule
- **Major releases (X.0.0)**: Annually (approximately)
- **Minor releases (X.Y.0)**: Quarterly
- **Patch releases (X.Y.Z)**: As needed for critical fixes

### Version Numbering

Superset follows [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
  ↓      ↓     ↓
  │      │     └── Bug fixes, security patches
  │      └────── New features, backwards compatible
  └──────────── Breaking changes
```

### Examples
- `3.0.0`: Major release with breaking changes
- `3.1.0`: Minor release with new features
- `3.1.1`: Patch release with bug fixes

## Release Types

### Major Releases (X.0.0)

#### Includes
- Breaking API changes
- Deprecated feature removals
- Major architectural changes
- Database migration requirements

#### Process
- 2-3 month preparation period
- Multiple release candidates (RC)
- Extensive testing period
- Migration guides required

### Minor Releases (X.Y.0)

#### Includes
- New features
- Performance improvements
- Non-breaking API additions
- Minor UI/UX updates

#### Process
- 1 month preparation
- 1-2 release candidates
- Standard testing period

### Patch Releases (X.Y.Z)

#### Includes
- Bug fixes
- Security patches
- Documentation fixes
- Dependency updates (security)

#### Process
- Fast track for critical issues
- May skip RC for urgent security fixes
- Minimal testing requirements

## Release Process (For Release Managers)

### 1. Pre-Release Preparation

#### Feature Freeze
```bash
# Create release branch
git checkout -b release-X.Y
git push upstream release-X.Y

# Update version
# Edit setup.py and package.json
VERSION = "X.Y.0rc1"
```

#### Update Documentation
- CHANGELOG.md
- UPDATING.md (for breaking changes)
- Documentation version

#### Release Notes Template
```markdown
# Apache Superset X.Y.0

## 🎉 Highlights
- Major feature 1
- Major feature 2

## 🚀 New Features
- Feature 1 (#PR)
- Feature 2 (#PR)

## 🐛 Bug Fixes
- Fix 1 (#PR)
- Fix 2 (#PR)

## ⚠️ Breaking Changes
- Breaking change 1
- Migration required for X

## 📝 Documentation
- Doc update 1 (#PR)

## 🙏 Thank You
Thanks to all contributors!
```

### 2. Create Release Candidate

#### Build RC
```bash
# Tag release candidate
git tag -a vX.Y.Zrc1 -m "Apache Superset X.Y.Z RC1"
git push upstream vX.Y.Zrc1

# Build source distribution
python setup.py sdist

# Build wheel
python setup.py bdist_wheel

# Sign artifacts
gpg --armor --detach-sig dist/apache-superset-X.Y.Zrc1.tar.gz
```

#### Upload to staging
```bash
# Upload to Apache staging
svn co https://dist.apache.org/repos/dist/dev/superset
cd superset
mkdir X.Y.Zrc1
cp /path/to/dist/* X.Y.Zrc1/
svn add X.Y.Zrc1
svn commit -m "Add Apache Superset X.Y.Z RC1"
```

### 3. Voting Process

#### Call for Vote Email

Send to dev@superset.apache.org:

```
Subject: [VOTE] Release Apache Superset X.Y.Z RC1

Hi all,

I'd like to call a vote to release Apache Superset version X.Y.Z RC1.

The release candidate:
- Git tag: vX.Y.Zrc1
- Git hash: abc123def456
- Source: https://dist.apache.org/repos/dist/dev/superset/X.Y.Zrc1/

Resources:
- Release notes: [link]
- CHANGELOG: [link]
- PR list: [link]

The vote will be open for at least 72 hours.

[ ] +1 approve
[ ] +0 no opinion
[ ] -1 disapprove (and reason why)

Thanks,
[Your name]
```

#### Voting Rules
- **Duration**: Minimum 72 hours
- **Required**: 3 +1 votes from PMC members
- **Veto**: Any -1 vote must be addressed

#### Testing Checklist
```markdown
- [ ] Source builds successfully
- [ ] Docker image builds
- [ ] Basic functionality works
- [ ] No critical bugs
- [ ] License check passes
- [ ] Security scan clean
```

### 4. Release Approval

#### Tally Votes
```
Subject: [RESULT][VOTE] Release Apache Superset X.Y.Z RC1

The vote to release Apache Superset X.Y.Z RC1 has passed.

+1 votes (binding):
- PMC Member 1
- PMC Member 2
- PMC Member 3

+1 votes (non-binding):
- Contributor 1
- Contributor 2

0 votes:
- None

-1 votes:
- None

Thank you to everyone who tested and voted!
```

### 5. Perform Release

#### Promote RC to Release
```bash
# Tag final release
git tag -a vX.Y.Z -m "Apache Superset X.Y.Z"
git push upstream vX.Y.Z

# Move from dev to release
svn mv https://dist.apache.org/repos/dist/dev/superset/X.Y.Zrc1 \
       https://dist.apache.org/repos/dist/release/superset/X.Y.Z
```

#### Publish to PyPI
```bash
# Upload to PyPI
python -m twine upload dist/*X.Y.Z*
```

#### Build Docker Images
```bash
# Build and push Docker images
docker build -t apache/superset:X.Y.Z .
docker push apache/superset:X.Y.Z
docker tag apache/superset:X.Y.Z apache/superset:latest
docker push apache/superset:latest
```

### 6. Post-Release Tasks

#### Update Documentation
```bash
# Update docs version
cd docs
# Update docusaurus.config.js with new version
npm run build
```

#### Announcement Email

Send to announce@apache.org, dev@superset.apache.org:

```
Subject: [ANNOUNCE] Apache Superset X.Y.Z Released

The Apache Superset team is pleased to announce the release of
Apache Superset X.Y.Z.

Apache Superset is a modern data exploration and visualization platform.

This release includes [number] commits from [number] contributors.

Highlights:
- Feature 1
- Feature 2
- Bug fixes and improvements

Download: https://superset.apache.org/docs/installation/
Release Notes: https://github.com/apache/superset/releases/tag/vX.Y.Z
PyPI: https://pypi.org/project/apache-superset/
Docker: docker pull apache/superset:X.Y.Z

Thanks to all contributors who made this release possible!

The Apache Superset Team
```

#### Update GitHub Release
```bash
# Create GitHub release
gh release create vX.Y.Z \
  --title "Apache Superset X.Y.Z" \
  --notes-file RELEASE_NOTES.md
```

## For Contributors

### During Feature Freeze

#### What's Allowed
- ✅ Bug fixes
- ✅ Documentation updates
- ✅ Test improvements
- ✅ Security fixes

#### What's Not Allowed
- ❌ New features
- ❌ Major refactoring
- ❌ Breaking changes
- ❌ Risky changes

### Testing RCs

#### How to Test
```bash
# Install RC from staging
pip install https://dist.apache.org/repos/dist/dev/superset/X.Y.Zrc1/apache-superset-X.Y.Zrc1.tar.gz

# Or use Docker
docker pull apache/superset:X.Y.Zrc1
```

#### What to Test
- Your use cases
- New features mentioned in release notes
- Upgrade from previous version
- Database migrations
- Critical workflows

#### Reporting Issues
```markdown
Found issue in RC1:
- Description: [what's wrong]
- Steps to reproduce: [how to trigger]
- Impact: [blocker/major/minor]
- Suggested fix: [if known]
```

### CHANGELOG Maintenance

#### Format
```markdown
## X.Y.Z (YYYY-MM-DD)

### Features
- feat: Description (#PR_NUMBER)

### Fixes
- fix: Description (#PR_NUMBER)

### Breaking Changes
- BREAKING: Description (#PR_NUMBER)
  Migration: Steps to migrate
```

#### Generating CHANGELOG
```bash
# Use git log to generate initial list
git log --oneline vX.Y-1.Z..vX.Y.Z | grep -E "^[a-f0-9]+ (feat|fix|perf|refactor|docs)"

# Group by type and format
```

## Breaking Changes Process

### Documentation Required

#### UPDATING.md Entry
```markdown
# X.Y.Z

## Breaking Change: [Title]

### Description
What changed and why.

### Before
```python
# Old way
old_function(param1, param2)
```

### After
```python
# New way
new_function(param1, param2, param3)
```

### Migration Steps
1. Update your code to...
2. Run migration script...
3. Test that...
```

### Deprecation Process

1. **Version N**: Mark as deprecated
   ```python
   @deprecated(version="3.0.0", remove_in="4.0.0")
   def old_function():
       warnings.warn("Use new_function instead", DeprecationWarning)
   ```

2. **Version N+1**: Keep deprecated with warnings

3. **Version N+2**: Remove completely

## Security Releases

### Expedited Process
- No RC required for critical security fixes
- Coordinate with security@apache.org
- Embargo period may apply
- CVE assignment through ASF security team

### Security Advisory Template
```markdown
CVE-YYYY-XXXXX: [Title]

Severity: [Critical/High/Medium/Low]
Affected Versions: < X.Y.Z
Fixed Version: X.Y.Z

Description:
[Vulnerability description]

Mitigation:
[How to fix or work around]

Credit:
[Reporter name/organization]
```

## Resources

### Internal
- [Apache Release Policy](https://www.apache.org/legal/release-policy.html)
- [Superset Release History](https://github.com/apache/superset/releases)
- [Version Strategy Discussion](https://github.com/apache/superset/discussions)

### Tools
- [Release Scripts](https://github.com/apache/superset/tree/master/scripts/release)
- [Superset Repository Scripts](https://github.com/apache/superset/tree/master/scripts)

Next: Return to [Contributing Overview](./overview)
