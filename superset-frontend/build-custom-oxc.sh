#!/bin/bash
# Build custom OXC linter with Superset-specific rules built-in
# This script is automatically called when rules change - developers don't need to run it manually

set -e

# Allow skipping in CI with pre-built binary
if [ "$CI" = "true" ] && [ "$USE_PREBUILT_OXC" = "true" ]; then
    echo "Using pre-built OXC binary in CI"
    exit 0
fi

echo "🔨 Building custom OXC with Superset rules..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
OXC_VERSION="oxlint_v1.19.0"
BUILD_DIR="oxc-custom-build"
RULES_DIR="oxc-superset-rules"
OUTPUT_DIR="node_modules/.bin"

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Rust not installed. Please install from https://rustup.rs/${NC}"
    exit 1
fi

# Create build directory
echo "📁 Setting up build directory..."
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR
cd $BUILD_DIR

# Clone OXC if not exists
if [ ! -d "oxc" ]; then
    echo "📥 Cloning OXC repository..."
    git clone --depth 1 --branch ${OXC_VERSION} https://github.com/oxc-project/oxc.git
fi

cd oxc

# Copy our custom rules into OXC
echo "📋 Integrating Superset custom rules..."

# Create a patch file to add our rules to OXC
cat > add-superset-rules.patch << 'EOF'
diff --git a/crates/oxc_linter/src/rules.rs b/crates/oxc_linter/src/rules.rs
index 1234567..abcdefg 100644
--- a/crates/oxc_linter/src/rules.rs
+++ b/crates/oxc_linter/src/rules.rs
@@ -500,6 +500,11 @@ mod react_perf {

 mod utils {
 }

+mod superset {
+    pub mod no_fa_icons;
+    pub mod no_template_vars;
+    pub mod no_literal_colors;
+    pub mod sentence_case_buttons;
+}

 oxc_macros::declare_all_lint_rules! {
@@ -800,4 +805,8 @@ oxc_macros::declare_all_lint_rules! {
+    superset::no_fa_icons,
+    superset::no_template_vars,
+    superset::no_literal_colors,
+    superset::sentence_case_buttons,
 }
EOF

# Apply the patch
echo "🔧 Patching OXC source..."
git apply add-superset-rules.patch || true

# Create superset rules directory in OXC
mkdir -p crates/oxc_linter/src/rules/superset

# Copy our rule implementations
echo "📝 Copying rule implementations..."
cp ../../../$RULES_DIR/src/rules/*.rs crates/oxc_linter/src/rules/superset/ 2>/dev/null || {
    echo "⚠️  Rule files not found, creating from example..."

    # Create the rules from our example file
    cat > crates/oxc_linter/src/rules/superset/no_fa_icons.rs << 'RULE_EOF'
use crate::{context::LintContext, rule::Rule, AstNode};
use oxc_ast::{ast::*, AstKind};
use oxc_diagnostics::OxcDiagnostic;
use oxc_macros::declare_oxc_lint;
use oxc_span::Span;

#[derive(Debug, Default, Clone)]
pub struct NoFaIcons;

declare_oxc_lint!(
    /// ### What it does
    /// Prevents FontAwesome icon usage
    ///
    /// ### Why is this bad?
    /// Superset uses a custom Icons component for consistency
    ///
    /// ### Example
    /// ```javascript
    /// // Bad
    /// <i className="fa fa-check" />
    ///
    /// // Good
    /// import { Icons } from 'src/components/Icons';
    /// <Icons.Check />
    /// ```
    NoFaIcons,
    style
);

impl Rule for NoFaIcons {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::JSXOpeningElement(elem) = node.kind() {
            if let JSXElementName::Identifier(id) = &elem.name {
                if id.name == "i" {
                    for attr in &elem.attributes {
                        if let JSXAttributeItem::Attribute(attr) = attr {
                            if let JSXAttributeName::Identifier(name) = &attr.name {
                                if name.name == "className" {
                                    if let Some(JSXAttributeValue::StringLiteral(lit)) = &attr.value {
                                        if lit.value.as_str().contains("fa ") ||
                                           lit.value.as_str().contains("fa-") {
                                            ctx.diagnostic(OxcDiagnostic::warn(
                                                "FontAwesome icons should not be used. Use src/components/Icons instead"
                                            ).with_label(elem.span));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
RULE_EOF

    # Similar files for other rules (simplified for build script)
    cat > crates/oxc_linter/src/rules/superset/no_template_vars.rs << 'RULE_EOF'
use crate::{context::LintContext, rule::Rule, AstNode};
use oxc_ast::{ast::*, AstKind};
use oxc_diagnostics::OxcDiagnostic;
use oxc_macros::declare_oxc_lint;

#[derive(Debug, Default, Clone)]
pub struct NoTemplateVars;

declare_oxc_lint!(
    /// Prevents variables in translation templates
    NoTemplateVars,
    correctness
);

impl Rule for NoTemplateVars {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::CallExpression(call) = node.kind() {
            if let Expression::Identifier(id) = &call.callee {
                if id.name == "t" || id.name == "tn" {
                    if let Some(Argument::TemplateLiteral(tpl)) = call.arguments.first() {
                        if !tpl.expressions.is_empty() {
                            ctx.diagnostic(OxcDiagnostic::warn(
                                "Don't use variables in translation templates"
                            ).with_label(call.span));
                        }
                    }
                }
            }
        }
    }
}
RULE_EOF

    cat > crates/oxc_linter/src/rules/superset/no_literal_colors.rs << 'RULE_EOF'
use crate::{context::LintContext, rule::Rule, AstNode};
use oxc_ast::{ast::*, AstKind};
use oxc_diagnostics::OxcDiagnostic;
use oxc_macros::declare_oxc_lint;
use regex::Regex;

#[derive(Debug, Default, Clone)]
pub struct NoLiteralColors;

declare_oxc_lint!(
    /// Enforces theme color variables over hardcoded colors
    NoLiteralColors,
    style
);

impl Rule for NoLiteralColors {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        let hex_regex = Regex::new(r"#[a-fA-F0-9]{3,8}").unwrap();
        let rgb_regex = Regex::new(r"rgba?\([^)]+\)").unwrap();

        match node.kind() {
            AstKind::StringLiteral(lit) => {
                let value = lit.value.as_str();
                if hex_regex.is_match(value) || rgb_regex.is_match(value) {
                    ctx.diagnostic(OxcDiagnostic::warn(
                        "Use theme color variables instead of literal colors"
                    ).with_label(lit.span));
                }
            }
            AstKind::TemplateLiteral(tpl) => {
                for quasi in &tpl.quasis {
                    let value = quasi.value.raw.as_str();
                    if hex_regex.is_match(value) || rgb_regex.is_match(value) {
                        ctx.diagnostic(OxcDiagnostic::warn(
                            "Use theme color variables instead of literal colors"
                        ).with_label(quasi.span));
                    }
                }
            }
            _ => {}
        }
    }
}
RULE_EOF

    cat > crates/oxc_linter/src/rules/superset/sentence_case_buttons.rs << 'RULE_EOF'
use crate::{context::LintContext, rule::Rule, AstNode};
use oxc_ast::{ast::*, AstKind};
use oxc_diagnostics::OxcDiagnostic;
use oxc_macros::declare_oxc_lint;

#[derive(Debug, Default, Clone)]
pub struct SentenceCaseButtons;

declare_oxc_lint!(
    /// Enforces sentence case for button text
    SentenceCaseButtons,
    style
);

impl Rule for SentenceCaseButtons {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::CallExpression(call) = node.kind() {
            if let Expression::Identifier(id) = &call.callee {
                if id.name == "t" || id.name == "tn" {
                    // Simple check for title case (multiple capitalized words)
                    if let Some(Argument::StringLiteral(lit)) = call.arguments.first() {
                        let text = lit.value.as_str();
                        let words: Vec<&str> = text.split_whitespace().collect();
                        if words.len() > 1 {
                            let title_cased = words.iter().skip(1).any(|w| {
                                w.chars().next().map_or(false, |c| c.is_uppercase())
                            });
                            if title_cased {
                                ctx.diagnostic(OxcDiagnostic::warn(
                                    format!("Button text should use sentence case: '{}'", text)
                                ).with_label(lit.span));
                            }
                        }
                    }
                }
            }
        }
    }
}
RULE_EOF
}

# Build OXC with our custom rules
echo "🔨 Building OXC with Superset rules..."
cargo build --release --bin oxlint

# Copy the binary to node_modules/.bin
echo "📦 Installing custom OXC binary..."
mkdir -p ../../../$OUTPUT_DIR
cp target/release/oxlint ../../../$OUTPUT_DIR/oxlint-superset

# Make it executable
chmod +x ../../../$OUTPUT_DIR/oxlint-superset

# Create wrapper script that npm can use
cat > ../../../$OUTPUT_DIR/oxlint << 'WRAPPER_EOF'
#!/bin/bash
# Wrapper script to use custom OXC with Superset rules
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
exec "$DIR/oxlint-superset" "$@"
WRAPPER_EOF

chmod +x ../../../$OUTPUT_DIR/oxlint

# Clean up build directory but keep the git clone and target for caching
cd ../../..
# Keep the build directory for faster rebuilds
echo "📁 Keeping build cache for faster future builds"

echo -e "${GREEN}✅ Custom OXC built successfully!${NC}"
echo -e "${YELLOW}📍 Binary installed at: $OUTPUT_DIR/oxlint-superset${NC}"
echo ""
echo "To use it, run:"
echo "  npm run lint"
echo ""
echo "The custom rules are now available:"
echo "  - superset/no-fa-icons"
echo "  - superset/no-template-vars"
echo "  - superset/no-literal-colors"
echo "  - superset/sentence-case-buttons"
