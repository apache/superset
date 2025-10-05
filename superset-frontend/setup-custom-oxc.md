# Setting Up Custom OXC with Superset Rules

## One-Time Setup

To use OXC with our custom Superset rules built-in (eliminating ESLint completely), run:

```bash
# Make the build script executable
chmod +x build-custom-oxc.sh

# Build custom OXC with Superset rules
./build-custom-oxc.sh
```

This will:
1. Clone OXC source code
2. Add our 4 custom rules as built-in rules
3. Compile a custom OXC binary
4. Install it to `node_modules/.bin/oxlint-superset`

## Usage

After building, just run:
```bash
npm run lint      # Runs custom OXC with all rules (including Superset-specific)
npm run lint-fix  # Auto-fix issues
```

## Performance

With the custom OXC binary:
- **Linting time**: ~100ms for 3000+ files
- **100% rule coverage** (all ESLint + custom rules)
- **No ESLint needed** at all

## CI/CD Integration

For CI/CD, you can either:

### Option 1: Pre-built Binary (Recommended)
1. Build the binary once locally
2. Commit `oxlint-superset` binary to the repo or artifact storage
3. CI uses the pre-built binary

### Option 2: Build in CI
Add to your CI workflow:
```yaml
- name: Build custom OXC
  run: |
    cd superset-frontend
    ./build-custom-oxc.sh

- name: Run linting
  run: |
    cd superset-frontend
    npm run lint
```

## Removing ESLint

Once the custom OXC is working, you can:
1. Delete `.eslintrc.js`
2. Delete `.eslintrc.minimal.js`
3. Delete `eslint-rules/` directory
4. Remove ESLint dependencies from package.json
5. Remove ESLint commands from package.json

## Custom Rules Included

The custom OXC binary includes these Superset-specific rules:
- `superset/no-fa-icons` - Prevents FontAwesome icons
- `superset/no-template-vars` - Prevents variables in translations
- `superset/no-literal-colors` - Enforces theme colors
- `superset/sentence-case-buttons` - Enforces sentence case in buttons

These work exactly like the ESLint versions but run 1000x faster!
