// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

use lazy_static::lazy_static;
use oxc_ast::{ast::*, AstKind};
use oxc_diagnostics::OxcDiagnostic;
use oxc_linter::{context::LintContext, rule::Rule, AstNode};
use oxc_macros::declare_oxc_lint;
use oxc_span::Span;
use regex::Regex;

#[derive(Debug, Default, Clone)]
pub struct NoLiteralColorsRule;

declare_oxc_lint!(
    /// ### What it does
    /// Enforces the use of theme color variables instead of hardcoded colors
    ///
    /// ### Why is this bad?
    /// Hardcoded colors break theming capabilities and make it difficult to maintain
    /// consistent color schemes across the application.
    ///
    /// ### Example
    /// ```js
    /// // Bad
    /// const styles = css`
    ///   color: #ff0000;
    ///   background: rgb(255, 0, 0);
    ///   border: 1px solid red;
    /// `;
    ///
    /// // Good
    /// const styles = css`
    ///   color: ${theme.colors.error};
    ///   background: ${theme.colors.primary};
    ///   border: 1px solid ${theme.colors.border};
    /// `;
    /// ```
    NoLiteralColorsRule,
    style
);

lazy_static! {
    // Regex for hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
    static ref HEX_COLOR_REGEX: Regex = Regex::new(
        r"#([a-fA-F0-9]{3}|[a-fA-F0-9]{4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})\b"
    ).unwrap();

    // Regex for rgb/rgba colors
    static ref RGB_COLOR_REGEX: Regex = Regex::new(
        r"rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)"
    ).unwrap();

    // CSS color keywords (common ones that should use theme variables)
    static ref COLOR_KEYWORDS: Vec<&'static str> = vec![
        "red", "blue", "green", "yellow", "orange", "purple", "pink",
        "black", "white", "gray", "grey", "brown", "cyan", "magenta",
        "navy", "teal", "silver", "gold", "indigo", "violet",
        "crimson", "coral", "salmon", "turquoise", "lime", "olive"
    ];
}

impl Rule for NoLiteralColorsRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        match node.kind() {
            // Check template literals (styled-components, emotion)
            AstKind::TemplateLiteral(template) => {
                if is_styled_component_context(node) {
                    check_template_literal(template, ctx);
                }
            }
            // Check string literals in style objects
            AstKind::StringLiteral(str_lit) => {
                if is_style_property_value(node) {
                    check_string_literal(str_lit, ctx);
                }
            }
            _ => {}
        }
    }
}

fn is_styled_component_context(node: &AstNode) -> bool {
    // Check if parent is a tagged template expression
    if let Some(parent) = node.parent() {
        if let AstKind::TaggedTemplateExpression(tagged) = parent.kind() {
            // Check for common CSS-in-JS tags: styled, css, keyframes, createGlobalStyle
            if let Expression::Identifier(ident) = &tagged.tag {
                let name = ident.name.as_str();
                return name == "css" || name == "styled" || name == "keyframes";
            }
            // Check for styled.div, styled.button, etc.
            if let Expression::StaticMemberExpression(member) = &tagged.tag {
                if let Expression::Identifier(obj) = &member.object {
                    return obj.name == "styled";
                }
            }
        }
    }
    false
}

fn is_style_property_value(node: &AstNode) -> bool {
    // Check if this string is a value in a style-related property
    if let Some(parent) = node.parent() {
        if let AstKind::PropertyDefinition(prop) = parent.kind() {
            if let PropertyKey::Identifier(ident) = &prop.key {
                let name = ident.name.as_str();
                // Common style-related property names
                return name.contains("color")
                    || name.contains("Color")
                    || name.contains("background")
                    || name.contains("Background")
                    || name.contains("border")
                    || name.contains("Border")
                    || name == "fill"
                    || name == "stroke";
            }
        }
        if let AstKind::ObjectProperty(prop) = parent.kind() {
            if let PropertyKey::Identifier(ident) = &prop.key {
                let name = ident.name.as_str();
                return name.contains("color")
                    || name.contains("Color")
                    || name.contains("background")
                    || name.contains("Background")
                    || name.contains("border")
                    || name.contains("Border")
                    || name == "fill"
                    || name == "stroke";
            }
        }
    }
    false
}

fn check_template_literal(template: &TemplateLiteral, ctx: &LintContext) {
    for element in &template.quasis {
        let content = element.value.raw.as_str();
        check_color_content(content, element.span, ctx);
    }
}

fn check_string_literal(str_lit: &StringLiteral, ctx: &LintContext) {
    let content = str_lit.value.as_str();
    check_color_content(content, str_lit.span, ctx);
}

fn check_color_content(content: &str, span: Span, ctx: &LintContext) {
    // Check for hex colors
    if HEX_COLOR_REGEX.is_match(content) {
        ctx.diagnostic(no_literal_colors_diagnostic(span, "hex"));
        return;
    }

    // Check for rgb/rgba colors
    if RGB_COLOR_REGEX.is_match(content) {
        ctx.diagnostic(no_literal_colors_diagnostic(span, "rgb(a)"));
        return;
    }

    // Check for color keywords in CSS property values
    for keyword in COLOR_KEYWORDS.iter() {
        // Look for patterns like ": red" or " red;" in CSS
        let colon_pattern = format!(": {}", keyword);
        let semicolon_pattern = format!(" {};", keyword);
        let exact_match = content == *keyword;

        if content.contains(&colon_pattern)
            || content.contains(&semicolon_pattern)
            || exact_match {
            ctx.diagnostic(no_literal_colors_diagnostic(span, "literal"));
            return;
        }
    }
}

fn no_literal_colors_diagnostic(span: Span, color_type: &str) -> OxcDiagnostic {
    OxcDiagnostic::warn(format!(
        "Theme color variables are preferred over {}/literal colors",
        color_type
    ))
    .with_label(span)
    .with_help("Use theme.colors.* variables instead of hardcoded colors")
}

#[test]
fn test() {
    use oxc_linter::tester::Tester;

    let pass = vec![
        r#"const color = theme.colors.primary"#,
        r#"const styles = css`color: ${theme.colors.text};`"#,
        r#"const bg = props.backgroundColor"#,
        r#"const Component = styled.div`color: ${props => props.theme.colors.primary};`"#,
    ];

    let fail = vec![
        r#"const styles = css`color: #ff0000;`"#,
        r#"const styles = css`background: rgb(255, 0, 0);`"#,
        r#"const styles = css`border: 1px solid red;`"#,
        r#"const color = { backgroundColor: '#ffffff' }"#,
        r#"styled.div`color: blue;`"#,
    ];

    Tester::new(NoLiteralColorsRule::NAME, pass, fail).test();
}
