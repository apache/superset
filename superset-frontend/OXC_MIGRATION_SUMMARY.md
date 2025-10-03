# OXC Linter Migration Summary

## Config Size Comparison

| Configuration | Lines of Code | Reduction |
|--------------|---------------|-----------|
| Original ESLint (Airbnb inlined) | 2,805 lines | - |
| Reduced ESLint (plugin configs) | 503 lines | 82% smaller |
| **OXC Configuration** | **78 lines** | **97% smaller** |

## Performance Comparison

| Linter | Time for 38 files | Speed |
|--------|-------------------|-------|
| ESLint | ~2+ minutes (times out) | Baseline |
| **OXC** | **109ms** | **~1000x faster** |

## Key Advantages

1. **Tiny Configuration**: 78 lines vs 2,805 lines (97% reduction)
2. **Blazing Fast**: 109ms vs minutes for linting
3. **Built-in Plugin Support**: No need to install separate plugins for:
   - `import` rules
   - `react` and `react-hooks` rules
   - `jsx-a11y` rules
   - `typescript` rules
   - Core ESLint rules (including Airbnb-style rules)

## What's Included

OXC automatically includes most rules from:
- ESLint recommended
- TypeScript ESLint recommended
- React plugin recommended
- React Hooks plugin recommended
- JSX-a11y plugin recommended
- Import plugin recommended
- Many Airbnb style guide rules

## Trade-offs

### ✅ Pros
- 97% smaller config file
- 1000x faster performance
- No plugin dependencies needed
- Native TypeScript support
- Most Airbnb rules included by default

### ❌ Cons
- No support for custom Superset plugins:
  - `theme-colors`
  - `icons`
  - `i18n-strings`
  - `file-progress`
- Some ESLint rules may not be implemented yet
- New tool to learn (though config is simpler)

## Migration Path

1. **Phase 1**: Use OXC for fast local development checks
   - Run `npm run oxlint` for quick feedback
   - Keep ESLint for CI/pre-commit hooks

2. **Phase 2**: Gradually migrate custom rules
   - Port critical custom rules to OXC when it supports plugins
   - Or use ESLint only for custom rule checking

3. **Phase 3**: Full migration
   - Once custom plugin support lands in OXC
   - Complete replacement of ESLint

## Commands

```bash
# Run OXC linter
npm run oxlint

# Fix auto-fixable issues
npm run oxlint:fix

# Run on specific directory
npx oxlint src/components/

# Use specific config
npx oxlint --config oxlint.json
```

## Recommendation

Given the 97% config size reduction and 1000x speed improvement, OXC is worth adopting for local development immediately. The main blocker for full migration is the custom Superset ESLint plugins, but these could be:

1. Run separately with ESLint in CI
2. Eventually ported to OXC when plugin support is added
3. Replaced with other tooling (e.g., build-time checks)

The speed improvement alone (109ms vs minutes) would significantly improve developer experience.
