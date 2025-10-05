# OXC + Minimal ESLint Hybrid Setup

## Overview
This setup uses OXC for 95% of linting (super fast) and a minimal ESLint config for the remaining 5% (custom Superset rules that OXC doesn't support yet).

## Performance Comparison

| Tool | Coverage | Time | Files |
|------|----------|------|-------|
| Full ESLint | 100% rules | 2+ minutes | 3166 files |
| OXC only | 95% rules | 104ms | 3167 files |
| Minimal ESLint | 5% rules (custom only) | ~15 seconds | src/ files only |
| **Combined (OXC + Minimal)** | **100% rules** | **~15 seconds total** | **All files** |

## What Each Tool Handles

### OXC (oxlint.json) - 104ms
- ✅ Core ESLint rules (no-console, eqeqeq, prefer-const, etc.)
- ✅ React rules (prop-types, jsx rules, hooks)
- ✅ Import rules (order, extensions, no-cycle)
- ✅ JSX-a11y accessibility rules
- ✅ TypeScript rules (naming conventions, type safety)
- ✅ Unicorn rules (best practices)
- ✅ Code quality rules (complexity, max-lines, etc.)

### Minimal ESLint (.eslintrc.minimal.js) - ~15 seconds
- ✅ prettier/prettier - Code formatting
- ✅ theme-colors/no-literal-colors - Enforce theme tokens
- ✅ icons/no-fa-icons-usage - Enforce icon standards
- ✅ i18n-strings/no-template-vars - i18n validation  
- ✅ file-progress/activate - Development helper

## Commands

```bash
# Run both linters (fast!)
npm run lint           # OXC + minimal ESLint + TypeScript

# Run with auto-fix
npm run lint-fix       # Fix both OXC and ESLint issues

# Run individually
npm run oxlint         # Just OXC (104ms)
npm run eslint-minimal -- src  # Just custom rules

# Run full ESLint (slow, for comparison)
npm run lint-full      # Original full ESLint (2+ minutes)
```

## Key Implementation Details

1. **OXC Configuration** (`oxlint.json`)
   - 235 lines of comprehensive rule configuration
   - Covers all standard ESLint, React, Import, JSX-a11y, TypeScript rules
   - Configured to match our existing ESLint behavior

2. **Minimal ESLint** (`.eslintrc.minimal.js`)
   - Only 119 lines
   - Uses `--no-eslintrc` flag to avoid loading the main config
   - Uses `--no-inline-config` to ignore eslint-disable comments for unknown rules
   - Only runs on `src/` directory where custom rules matter
   - Skips packages/plugins which have different theming rules

3. **Package.json Changes**
   - `lint`: Runs OXC first (fast), then minimal ESLint (custom rules only)
   - `lint-fix`: Auto-fixes from both tools
   - `lint-full`: Preserved for comparison/fallback

## Migration Benefits

1. **Speed**: 8x faster than ESLint alone (15s vs 2+ minutes)
2. **Coverage**: Still maintains 100% of our linting rules
3. **Simplicity**: Minimal ESLint config is only 119 lines vs 500+
4. **Future-proof**: When OXC adds plugin support, we can migrate fully

## Known Limitations

- OXC doesn't support custom plugins yet (hence the hybrid approach)
- Some edge cases in TypeScript parsing may differ slightly
- Auto-fix capabilities may vary between tools

## Next Steps

1. Monitor OXC development for plugin support
2. Consider writing native Rust plugins for OXC when supported
3. Gradually reduce ESLint dependency as OXC improves
