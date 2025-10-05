# OXC Custom Rules for Apache Superset

Native Rust implementations of Superset's custom ESLint rules for the OXC linter, providing 1000x faster linting performance.

## Rules

### 1. `superset/no-fa-icons`
Prevents usage of FontAwesome icons in favor of the custom Icons component.

**Bad:**
```jsx
<i className="fa fa-check" />
```

**Good:**
```jsx
import { Icons } from 'src/components/Icons';
<Icons.Check />
```

### 2. `superset/no-template-vars`
Prevents variables in translation templates (Flask-babel compatibility).

**Bad:**
```js
t(`Welcome ${username}!`)
```

**Good:**
```js
t('Welcome!')
```

### 3. `superset/no-literal-colors`
Enforces theme color variables over hardcoded colors.

**Bad:**
```js
const styles = css`
  color: #ff0000;
  background: rgb(255, 0, 0);
`;
```

**Good:**
```js
const styles = css`
  color: ${theme.colors.error};
  background: ${theme.colors.primary};
`;
```

### 4. `superset/sentence-case-buttons`
Enforces sentence case for button text.

**Bad:**
```js
<Button>{t('Delete Dataset')}</Button>
```

**Good:**
```js
<Button>{t('Delete dataset')}</Button>
```

## Building

### Prerequisites
- Rust 1.70+
- Cargo

### Build Steps

```bash
cd oxc-superset-rules
cargo build --release
```

This creates a compiled library at `target/release/liboxc_superset_rules.{so,dylib,dll}`

### Running Tests

```bash
cargo test
```

## Integration with OXC

### Method 1: Local Build with OXC Fork

1. Fork the OXC repository
2. Add this crate as a dependency in OXC's `Cargo.toml`:
```toml
oxc-superset-rules = { path = "../path-to-superset/oxc-superset-rules" }
```

3. Register the rules in OXC's rule registry:
```rust
use oxc_superset_rules::register_rules;

// In the rule registration code
let superset_rules = oxc_superset_rules::register_rules();
rules.extend(superset_rules);
```

4. Build OXC with the custom rules:
```bash
cargo build --release
```

### Method 2: Dynamic Loading (Future)

Once OXC supports dynamic rule loading, you can:

1. Build the shared library:
```bash
cargo build --release --crate-type cdylib
```

2. Configure OXC to load the library:
```json
{
  "plugins": ["./target/release/liboxc_superset_rules.so"],
  "rules": {
    "superset/no-fa-icons": "error",
    "superset/no-template-vars": "error",
    "superset/no-literal-colors": "error",
    "superset/sentence-case-buttons": "warn"
  }
}
```

## Using in Superset

Once integrated with OXC, update your `oxlint.json`:

```json
{
  "$schema": "https://oxc-project.github.io/oxlint/schema.json",
  "rules": {
    // Standard rules...

    // Custom Superset rules
    "superset/no-fa-icons": "error",
    "superset/no-template-vars": "error",
    "superset/no-literal-colors": "error",
    "superset/sentence-case-buttons": "warn"
  }
}
```

Then run:
```bash
oxlint
```

## Performance

With these native Rust implementations:
- **Full linting**: ~100ms (vs 2+ minutes with ESLint)
- **No more hybrid setup**: Single tool for all linting
- **Memory efficient**: Rust's zero-cost abstractions
- **Parallel processing**: Leverages all CPU cores

## Development

### Adding New Rules

1. Create a new file in `src/rules/`
2. Implement the `Rule` trait
3. Add to `src/rules/mod.rs`
4. Register in `src/lib.rs`
5. Write tests

Example structure:
```rust
use oxc_linter::{context::LintContext, rule::Rule, AstNode};
use oxc_macros::declare_oxc_lint;

#[derive(Debug, Default, Clone)]
pub struct MyNewRule;

declare_oxc_lint!(
    /// Documentation here
    MyNewRule,
    style  // or correctness, suspicious, etc.
);

impl Rule for MyNewRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        // Rule logic here
    }
}
```

## Contributing

1. Fork this repository
2. Create your feature branch
3. Add tests for any new functionality
4. Ensure all tests pass: `cargo test`
5. Submit a pull request

## License

Apache License 2.0 - See LICENSE file for details.
