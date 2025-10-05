// Example: Native Rust implementation of Superset's custom ESLint rules for OXC
// This demonstrates how to port the custom rules to achieve 100% OXC migration

use oxc_ast::{ast::*, AstKind};
use oxc_diagnostics::OxcDiagnostic;
use oxc_linter::{context::LintContext, rule::Rule, AstNode};
use oxc_macros::declare_oxc_lint;

// ============================================================================
// Rule 1: no-fa-icons - Prevent FontAwesome usage
// ============================================================================
#[derive(Debug, Default, Clone)]
pub struct NoFaIconsRule;

declare_oxc_lint!(
    /// Prevents FontAwesome icons, enforces Icons component
    NoFaIconsRule,
    style
);

impl Rule for NoFaIconsRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::JSXOpeningElement(elem) = node.kind() {
            // Check for <i className="fa fa-*" />
            if is_i_element(elem) && has_fa_class(elem) {
                ctx.diagnostic(
                    OxcDiagnostic::warn("FontAwesome icons should not be used")
                        .with_help("Use src/components/Icons instead")
                );
            }
        }
    }
}

// ============================================================================
// Rule 2: no-template-vars - Prevent variables in translations
// ============================================================================
#[derive(Debug, Default, Clone)]
pub struct NoTemplateVarsRule;

declare_oxc_lint!(
    /// Prevents template variables in t() and tn() functions
    NoTemplateVarsRule,
    correctness
);

impl Rule for NoTemplateVarsRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::CallExpression(call) = node.kind() {
            if is_translation_function(&call.callee) {
                if let Some(Argument::TemplateLiteral(template)) = call.arguments.first() {
                    if !template.expressions.is_empty() {
                        ctx.diagnostic(
                            OxcDiagnostic::warn("No variables in translation templates")
                                .with_help("Flask-babel requires static strings")
                        );
                    }
                }
            }
        }
    }
}

// ============================================================================
// Rule 3: no-literal-colors - Enforce theme variables
// ============================================================================
#[derive(Debug, Default, Clone)]
pub struct NoLiteralColorsRule;

declare_oxc_lint!(
    /// Enforces theme color variables over hardcoded colors
    NoLiteralColorsRule,
    style
);

impl Rule for NoLiteralColorsRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        match node.kind() {
            AstKind::TemplateLiteral(template) if is_css_context(node) => {
                for element in &template.quasis {
                    let content = element.value.raw.as_str();
                    if has_color_value(content) {
                        ctx.diagnostic(
                            OxcDiagnostic::warn("Use theme colors instead of literals")
                                .with_help("Use theme.colors.* variables")
                        );
                    }
                }
            }
            AstKind::StringLiteral(str_lit) if is_style_prop(node) => {
                if has_color_value(str_lit.value.as_str()) {
                    ctx.diagnostic(
                        OxcDiagnostic::warn("Use theme colors instead of literals")
                            .with_help("Use theme.colors.* variables")
                    );
                }
            }
            _ => {}
        }
    }
}

// ============================================================================
// Rule 4: sentence-case-buttons - Enforce sentence case
// ============================================================================
#[derive(Debug, Default, Clone)]
pub struct SentenceCaseButtonsRule;

declare_oxc_lint!(
    /// Enforces sentence case for button text
    SentenceCaseButtonsRule,
    style
);

impl Rule for SentenceCaseButtonsRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::CallExpression(call) = node.kind() {
            if is_translation_function(&call.callee) && is_button_context(node) {
                if let Some(Argument::StringLiteral(str_lit)) = call.arguments.first() {
                    let text = str_lit.value.as_str();
                    if is_title_case(text) {
                        let suggested = to_sentence_case(text);
                        ctx.diagnostic(
                            OxcDiagnostic::warn(format!(
                                "Button text should be '{}' not '{}'",
                                suggested, text
                            ))
                        );
                    }
                }
            }
        }
    }
}

// ============================================================================
// Helper functions (simplified for example)
// ============================================================================

fn is_i_element(elem: &JSXOpeningElement) -> bool {
    matches!(&elem.name, JSXElementName::Identifier(id) if id.name == "i")
}

fn has_fa_class(elem: &JSXOpeningElement) -> bool {
    elem.attributes.iter().any(|attr| {
        if let JSXAttributeItem::Attribute(attr) = attr {
            if let JSXAttributeName::Identifier(id) = &attr.name {
                if id.name == "className" {
                    if let Some(JSXAttributeValue::StringLiteral(lit)) = &attr.value {
                        return lit.value.as_str().contains("fa ");
                    }
                }
            }
        }
        false
    })
}

fn is_translation_function(callee: &Expression) -> bool {
    matches!(callee, Expression::Identifier(id) if id.name == "t" || id.name == "tn")
}

fn is_css_context(node: &AstNode) -> bool {
    node.parent().map_or(false, |parent| {
        matches!(parent.kind(), AstKind::TaggedTemplateExpression(_))
    })
}

fn is_style_prop(node: &AstNode) -> bool {
    node.parent().map_or(false, |parent| {
        matches!(parent.kind(), AstKind::ObjectProperty(_))
    })
}

fn has_color_value(content: &str) -> bool {
    // Check for hex colors, rgb(), or color keywords
    content.contains('#')
        || content.contains("rgb")
        || content.contains(": red")
        || content.contains(": blue")
}

fn is_button_context(node: &AstNode) -> bool {
    // Check if parent is Button component or button prop
    node.parent().map_or(false, |parent| {
        matches!(parent.kind(), AstKind::JSXElement(_))
    })
}

fn is_title_case(text: &str) -> bool {
    // "Delete Dataset" -> true, "Delete dataset" -> false
    text.split_whitespace()
        .skip(1)
        .any(|word| word.chars().next().map_or(false, |c| c.is_uppercase()))
}

fn to_sentence_case(text: &str) -> String {
    let mut chars = text.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
    }
}

// ============================================================================
// Registration function for OXC
// ============================================================================
pub fn register_superset_rules() -> Vec<Box<dyn Rule>> {
    vec![
        Box::new(NoFaIconsRule),
        Box::new(NoTemplateVarsRule),
        Box::new(NoLiteralColorsRule),
        Box::new(SentenceCaseButtonsRule),
    ]
}
