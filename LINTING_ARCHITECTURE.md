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

# Superset Frontend Linting Architecture

## Overview
We use a hybrid linting approach combining OXC (fast, standard rules) with custom AST-based checks for Superset-specific patterns.

## Components

### 1. Primary Linter: OXC
- **What**: Oxidation Compiler's linter (oxlint)
- **Handles**: 95% of linting rules (standard ESLint rules, TypeScript, React, etc.)
- **Speed**: ~50-100x faster than ESLint
- **Config**: `oxlint.json`

### 2. Custom Rule Checker
- **What**: Node.js AST-based script
- **Handles**: Superset-specific rules:
  - No literal colors (use theme)
  - No FontAwesome icons (use Icons component)
  - No template vars in i18n
- **Speed**: Fast enough for pre-commit
- **Script**: `scripts/check-custom-rules.js`

## Developer Workflow

### Local Development
```bash
# Fast linting (OXC only)
npm run lint

# Full linting (OXC + custom rules)
npm run lint:full

# Auto-fix what's possible
npm run lint-fix
```

### Pre-commit
1. OXC runs first (via `scripts/oxlint.sh`)
2. Custom rules check runs second (lightweight, AST-based)
3. Both must pass for commit to succeed

### CI Pipeline
```yaml
- name: Lint with OXC
  run: npm run lint

- name: Check custom rules
  run: npm run check:custom-rules
```

## Why This Architecture?

### ✅ Pros
1. **No binary distribution issues** - ASF compatible
2. **Fast performance** - OXC for bulk, lightweight script for custom
3. **Maintainable** - Custom rules in JavaScript, not Rust
4. **Flexible** - Can evolve as OXC adds plugin support
5. **Cacheable** - Both OXC and Node.js are standard tools

### ❌ Cons  
1. **Two tools** - Slightly more complex than single linter
2. **Duplicate parsing** - Files parsed twice (once by each tool)

### 🔄 Migration Path
When OXC supports JavaScript plugins:
1. Convert `check-custom-rules.js` to OXC plugin format
2. Consolidate back to single tool
3. Keep same rules and developer experience

## Implementation Checklist

- [x] OXC for standard linting
- [x] Pre-commit integration  
- [ ] Custom rules script
- [ ] Combine in npm scripts
- [ ] Update CI pipeline
- [ ] Developer documentation

## Performance Targets

| Operation | Target Time | Current |
|-----------|------------|---------|
| Pre-commit (changed files) | <2s | ✅ 1.5s |
| Full lint (all files) | <10s | ✅ 8s |
| Custom rules check | <5s | 🔄 TBD |

## Caching Strategy

### Local Development
- OXC: Built-in incremental checking
- Custom rules: Use file hash cache (similar to pytest cache)

### CI
- Cache `node_modules` (includes oxlint binary)
- Cache custom rules results by commit hash
- Skip unchanged files using git diff

## Future Improvements

1. **When OXC adds plugin support**: Migrate custom rules to OXC plugins
2. **Consider Biome**: Another Rust-based linter with plugin support
3. **AST sharing**: Investigate sharing AST between tools to avoid double parsing
