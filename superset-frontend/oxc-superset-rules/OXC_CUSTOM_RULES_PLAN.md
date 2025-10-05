# Plan to Port Custom Superset ESLint Rules to OXC

## Overview
We have 4 custom ESLint rules that need to be ported to OXC to achieve 100% migration:

1. **theme-colors/no-literal-colors** - Enforce theme token usage
2. **icons/no-fa-icons-usage** - Prevent FontAwesome icon usage
3. **i18n-strings/no-template-vars** - Prevent variables in translation templates
4. **i18n-strings/sentence-case-buttons** - Enforce sentence case for button text

## Rule Complexity Analysis

### 1. theme-colors/no-literal-colors (MEDIUM complexity)
**Purpose**: Detect hardcoded colors in CSS-in-JS and enforce theme variables

**Logic**:
- Detects hex colors (#fff, #ffffff)
- Detects rgb/rgba colors
- Detects CSS color keywords (red, blue, etc.)
- Checks in template literals and object properties
- Maintains a warned list to avoid duplicates

**OXC Porting Effort**: Medium
- Need to parse template literals
- Pattern matching for colors
- Context-aware (only in styled components/CSS)

### 2. icons/no-fa-icons-usage (LOW complexity)
**Purpose**: Prevent FontAwesome icons, enforce custom Icons component

**Logic**:
- Checks for `<i className="fa fa-*" />`
- Simple JSX attribute checking

**OXC Porting Effort**: Low
- Simple JSX pattern matching
- No complex state tracking

### 3. i18n-strings/no-template-vars (LOW complexity)
**Purpose**: Prevent template variables in translation strings

**Logic**:
- Checks calls to `t()` and `tn()` functions
- Detects template literals with expressions
- Static analysis friendly

**OXC Porting Effort**: Low
- Function call detection
- Template literal analysis
- Straightforward pattern

### 4. i18n-strings/sentence-case-buttons (MEDIUM complexity)
**Purpose**: Enforce sentence case for button text

**Logic**:
- Detects button context (Button component, button props)
- Checks for title case patterns
- Suggests sentence case alternatives

**OXC Porting Effort**: Medium
- Context-aware (button detection)
- Text pattern analysis
- Suggestion generation

## Implementation Plan

### Phase 1: Setup OXC Custom Rule Development
1. Fork OXC repository
2. Set up Rust development environment
3. Study OXC's rule architecture
4. Create Superset rules module

### Phase 2: Port Simple Rules First
Start with the easiest rules to learn the OXC API:

#### A. icons/no-fa-icons-usage
```rust
// Pseudo-code structure
impl Rule for NoFaIconsUsage {
    fn run(&self, node: &AstNode, ctx: &LintContext) {
        if let AstNode::JSXElement(elem) = node {
            if elem.name == "i" && has_fa_class(elem.attributes) {
                ctx.diagnostic(ERROR_MESSAGE);
            }
        }
    }
}
```

#### B. i18n-strings/no-template-vars
```rust
impl Rule for NoTemplateVars {
    fn run(&self, node: &AstNode, ctx: &LintContext) {
        if let AstNode::CallExpression(call) = node {
            if is_translation_function(call.callee) {
                if has_template_expressions(call.arguments[0]) {
                    ctx.diagnostic(ERROR_MESSAGE);
                }
            }
        }
    }
}
```

### Phase 3: Port Complex Rules
#### C. theme-colors/no-literal-colors
```rust
impl Rule for NoLiteralColors {
    fn run(&self, node: &AstNode, ctx: &LintContext) {
        match node {
            AstNode::TemplateLiteral(template) => {
                if is_styled_component(template) {
                    check_color_patterns(template.raw, ctx);
                }
            }
            AstNode::ObjectProperty(prop) => {
                if is_style_prop(prop) {
                    check_color_patterns(prop.value, ctx);
                }
            }
        }
    }
}
```

#### D. i18n-strings/sentence-case-buttons
```rust
impl Rule for SentenceCaseButtons {
    fn run(&self, node: &AstNode, ctx: &LintContext) {
        if let AstNode::CallExpression(call) = node {
            if is_translation_function(call.callee) {
                if is_button_context(node.parent) {
                    check_sentence_case(call.arguments[0], ctx);
                }
            }
        }
    }
}
```

### Phase 4: Package and Distribute
1. Create a `superset-oxlint-rules` Rust crate
2. Publish to crates.io
3. Configure OXC to load custom rules
4. Update Superset's oxlint.json to enable custom rules

## Alternative: JavaScript Plugin System (if OXC adds it)
If OXC adds JavaScript plugin support (similar to ESLint), we could:
1. Port rules to JavaScript/TypeScript
2. Use OXC's plugin API
3. Maintain rules in the Superset repo

## Estimated Timeline
- Phase 1: 1 week (setup and learning)
- Phase 2: 1 week (simple rules)
- Phase 3: 2 weeks (complex rules)
- Phase 4: 1 week (packaging)

**Total: ~5 weeks for complete migration**

## Benefits of Full Migration
1. **Performance**: 100% OXC = sub-second linting
2. **Simplicity**: Single tool instead of hybrid
3. **Consistency**: All rules in same system
4. **Future-proof**: Rust ecosystem growing rapidly

## Next Steps
1. Check if OXC team accepts custom rule contributions
2. Evaluate if JavaScript plugin system is planned
3. Start with proof-of-concept for simplest rule
4. Get community feedback on approach
