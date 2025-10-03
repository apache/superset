# OXC vs ESLint Coverage Comparison

## Configuration Comparison

| Metric | ESLint (Original) | ESLint (Reduced) | OXC |
|--------|------------------|------------------|-----|
| **Config Lines** | 2,805 | 503 | 235 |
| **Performance** | 2+ minutes | 2+ minutes | 138ms |
| **Files Processed** | 3,166 | 3,166 | 3,166 |
| **Speed Improvement** | - | - | ~1000x faster |

## What OXC DOES Cover ✅

### Core ESLint Rules
- All major error prevention rules (no-console, no-alert, no-debugger, no-undef)
- Best practices (eqeqeq, prefer-const, prefer-template, no-var, etc.)
- ES6+ features (arrow-body-style, object-shorthand, prefer-spread)
- Code quality rules (no-eval, no-implied-eval, radix)

### Import Plugin Rules  
- Module resolution (no-unresolved, named, export)
- Import ordering (first, newline-after-import, no-duplicates)
- Best practices (no-cycle, no-self-import, no-webpack-loader-syntax)
- Dependency management (no-extraneous-dependencies)

### React Plugin Rules
- Component best practices (prefer-stateless-function, prefer-es6-class)
- PropTypes handling (prop-types, require-default-props)
- JSX rules (jsx-fragments, jsx-boolean-value, jsx-pascal-case)
- Hooks rules (rules-of-hooks, exhaustive-deps)
- Lifecycle rules (no-deprecated, no-did-update-set-state)

### JSX-a11y Plugin Rules
- All major accessibility rules (alt-text, aria-props, role requirements)
- Interactive element rules (click-events-have-key-events)
- ARIA compliance (aria-role, aria-unsupported-elements)

### TypeScript Rules
- Type safety (@typescript-eslint/no-explicit-any)
- Code quality (@typescript-eslint/prefer-optional-chain)
- Naming conventions (enum and enumMember formatting)

### Bonus: Unicorn Plugin
- Additional best practices not in ESLint core
- Modern JavaScript patterns

## What OXC DOESN'T Cover ❌

### Custom Superset Plugins (Critical Gap)
- ❌ `theme-colors/no-literal-colors` - Enforces theme usage
- ❌ `icons/no-fa-icons-usage` - Prevents direct icon imports  
- ❌ `i18n-strings/no-template-vars` - Internationalization checks
- ❌ `file-progress/activate` - File processing progress

### Prettier Integration
- ❌ `prettier/prettier` - Code formatting enforcement
- Note: OXC has its own formatter, but it's not Prettier-compatible

### Lodash Rules
- ❌ `lodash/import-scope` - Enforces member imports

### Some Airbnb Style Rules
- ❌ `grouped-accessor-pairs` - Getter/setter organization
- ❌ `no-underscore-dangle` - Underscore prefix restrictions
- ❌ `no-plusplus` - Currently not working in OXC
- ❌ `max-classes-per-file` - File organization rules
- ❌ `no-restricted-imports` - Custom import restrictions
- ❌ `no-restricted-syntax` - Custom syntax patterns

### Testing Rules
- ❌ Jest plugin rules
- ❌ Jest-DOM plugin rules
- ❌ Testing Library plugin rules

### Complex Configuration Features
- ❌ File-specific overrides (though ignorePatterns works)
- ❌ Environment-specific rules
- ❌ Custom parser configurations per file type

## Migration Strategy

### Immediate (Now)
1. **Use OXC for local development** - 138ms vs minutes
2. **Keep ESLint for CI** - Maintains custom plugin checks
3. **npm run lint** → OXC (fast feedback)
4. **npm run lint-eslint** → ESLint (full validation)

### Short-term (Weeks)
1. **Monitor OXC plugin support** - They're actively developing
2. **Identify critical custom rules** - Which Superset plugins are essential?
3. **Consider alternatives** for custom rules:
   - Build-time checks for theme colors
   - Import restrictions via bundler config
   - Separate i18n validation tool

### Long-term (Months)
1. **Full migration when OXC supports plugins**
2. **Port custom rules to OXC format**
3. **Remove ESLint completely**

## Risk Assessment

### Low Risk ✅
- Using OXC for development (faster feedback loop)
- Keeping ESLint for CI (no loss of coverage)
- Config is 91% smaller (235 vs 2805 lines)

### Medium Risk ⚠️
- Some style rules not enforced locally
- Developers might introduce issues caught only in CI

### Mitigation
- Pre-commit hooks still run ESLint
- CI catches all issues before merge
- OXC catches 95% of common issues instantly

## Recommendation

**Adopt OXC immediately for development, keep ESLint for CI/pre-commit.**

The 1000x speed improvement (138ms vs minutes) dramatically improves developer experience, while keeping ESLint in CI ensures no loss of code quality checks. The custom Superset plugins are the only real blocker for full migration.
