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

# Superset Frontend Linting

Apache Superset uses a hybrid linting approach combining OXC (Oxidation Compiler) for standard rules and a custom AST-based checker for Superset-specific rules.

## Architecture

The linting system consists of two components:

1. **OXC Linter** (`oxlint`) - A Rust-based linter that's 50-100x faster than ESLint
   - Handles all standard JavaScript/TypeScript rules
   - Configured via `oxlint.json`
   - Runs via `npm run lint` or `npm run lint-fix`

2. **Custom Rules Checker** - A Node.js AST-based checker for Superset-specific patterns
   - Enforces no literal colors (use theme colors)
   - Prevents FontAwesome usage (use @superset-ui/core Icons)
   - Validates i18n template usage (no template variables)
   - Runs via `npm run check:custom-rules`

## Usage

### Quick Commands

```bash
# Run both OXC and custom rules
npm run lint:full

# Run OXC linter only (faster for most checks)
npm run lint

# Fix auto-fixable issues with OXC
npm run lint-fix

# Run custom rules checker only
npm run check:custom-rules

# Run on specific files
npm run lint-fix src/components/Button/index.tsx
npm run check:custom-rules src/theme/*.tsx
```

### Pre-commit Hooks

The linting system is integrated with pre-commit hooks:

```bash
# Install pre-commit hooks
pre-commit install

# Run hooks manually on staged files
pre-commit run

# Run on specific files
pre-commit run --files superset-frontend/src/file.tsx
```

## Configuration

### OXC Configuration (`oxlint.json`)

The OXC configuration includes:

- Standard ESLint rules
- React and React Hooks rules
- TypeScript rules
- Import/export rules
- JSX accessibility rules
- Unicorn rules for additional coverage

### Custom Rules

The custom rules are implemented in `scripts/check-custom-rules.js` and check for:

1. **No Literal Colors**: Enforces using theme colors instead of hardcoded hex/rgb values
2. **No FontAwesome**: Requires using `@superset-ui/core` Icons component
3. **Proper i18n Usage**: Prevents template variables in translation functions

## Performance

The hybrid approach provides:

- **50-100x faster linting** compared to ESLint for standard rules via OXC
- **Selective checking** - custom rules only run on changed files during pre-commit
- **Parallel execution** - OXC and custom rules can run concurrently

## Troubleshooting

### "Plugin 'basic-custom-plugin' not found" Error

If you see this error when running `npm run lint`, ensure you're using the explicit config:

```bash
npx oxlint --config oxlint.json
```

### Custom Rules Not Running

Verify the AST parsing dependencies are installed:

```bash
npm ls @babel/parser @babel/traverse glob
```

### Pre-commit Hook Failures

Ensure your changes are staged:

```bash
git add .
pre-commit run
```

## Development

### Adding New Custom Rules

1. Edit `scripts/check-custom-rules.js`
2. Add a new check function following the pattern:

```javascript
function checkNewRule(ast, filepath) {
  traverse(ast, {
    // AST visitor pattern
  });
}
```

3. Call the function in `processFile()`

### Updating OXC Rules

1. Edit `oxlint.json`
2. Test with `npm run lint`
3. Update ignore patterns if needed

## Migration from ESLint

This hybrid approach replaces the previous ESLint setup while maintaining all custom Superset linting rules. The migration provides:

- Significantly faster linting (50-100x improvement)
- Compatibility with Apache Software Foundation requirements (no custom binaries)
- Maintainable JavaScript-based custom rules

## CI/CD Integration

The linting system is integrated into CI via GitHub Actions. See `.github/workflows/superset-frontend-lint.yml` for the CI configuration.
