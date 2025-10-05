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

use oxc_ast::{ast::*, AstKind};
use oxc_diagnostics::OxcDiagnostic;
use oxc_linter::{context::LintContext, rule::Rule, AstNode};
use oxc_macros::declare_oxc_lint;
use oxc_span::Span;
use regex::Regex;

#[derive(Debug, Default, Clone)]
pub struct SentenceCaseButtonsRule;

declare_oxc_lint!(
    /// ### What it does
    /// Enforces sentence case for button text in translation functions
    ///
    /// ### Why is this bad?
    /// Title case in buttons ("Delete Dataset") is inconsistent with modern UI guidelines.
    /// Sentence case ("Delete dataset") provides better readability and consistency.
    ///
    /// ### Example
    /// ```js
    /// // Bad
    /// t('Delete Dataset')
    /// t('Create New Chart')
    ///
    /// // Good
    /// t('Delete dataset')
    /// t('Create new chart')
    /// ```
    SentenceCaseButtonsRule,
    style
);

impl Rule for SentenceCaseButtonsRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::CallExpression(call_expr) = node.kind() {
            // Check if this is a translation function call
            if !is_translation_function(&call_expr.callee) {
                return;
            }

            // Check if we're in a button context
            if !is_button_context(node) {
                return;
            }

            // Check first argument for title case text
            if let Some(first_arg) = call_expr.arguments.first() {
                if let Argument::StringLiteral(str_lit) = first_arg {
                    let text = str_lit.value.as_str();
                    if is_title_case(text) {
                        let sentence_case = to_sentence_case(text);
                        ctx.diagnostic(sentence_case_diagnostic(
                            str_lit.span,
                            text,
                            &sentence_case,
                        ));
                    }
                }
            }
        }
    }
}

fn is_translation_function(callee: &Expression) -> bool {
    if let Expression::Identifier(ident) = callee {
        let name = ident.name.as_str();
        name == "t" || name == "tn"
    } else {
        false
    }
}

fn is_button_context(node: &AstNode) -> bool {
    // Check if parent is a button-related property or JSX element
    let mut current = node.parent();

    // Look up the tree (max 3 levels) for button context
    for _ in 0..3 {
        if let Some(parent) = current {
            match parent.kind() {
                // Check for button-specific property names
                AstKind::ObjectProperty(prop) => {
                    if let PropertyKey::Identifier(ident) = &prop.key {
                        let name = ident.name.as_str();
                        if is_button_prop_name(name) {
                            return true;
                        }
                    }
                }
                // Check for JSX Button component
                AstKind::JSXExpressionContainer(_) => {
                    if let Some(jsx_parent) = parent.parent() {
                        if let AstKind::JSXElement(element) = jsx_parent.kind() {
                            if is_button_element(&element.opening_element) {
                                return true;
                            }
                        }
                    }
                }
                _ => {}
            }
            current = parent.parent();
        } else {
            break;
        }
    }

    false
}

fn is_button_prop_name(name: &str) -> bool {
    matches!(
        name,
        "primaryButtonName"
            | "secondaryButtonName"
            | "confirmButtonText"
            | "cancelButtonText"
            | "buttonText"
            | "submitButtonText"
            | "okText"
            | "cancelText"
    )
}

fn is_button_element(element: &JSXOpeningElement) -> bool {
    if let JSXElementName::Identifier(ident) = &element.name {
        let name = ident.name.as_str();
        // Check for common button component names
        name == "Button" || name == "SubmitButton" || name == "ActionButton"
    } else {
        false
    }
}

fn is_title_case(text: &str) -> bool {
    // Title case pattern: "Word Word" where each word starts with uppercase
    // Must have at least 2 words to be considered title case
    let title_case_regex = Regex::new(r"^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$").unwrap();
    title_case_regex.is_match(text)
}

fn to_sentence_case(text: &str) -> String {
    // Convert to sentence case: lowercase everything except first letter
    if text.is_empty() {
        return String::new();
    }

    let mut chars = text.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase(),
    }
}

fn sentence_case_diagnostic(span: Span, original: &str, suggested: &str) -> OxcDiagnostic {
    OxcDiagnostic::warn(format!(
        "Button text should use sentence case: \"{}\" should be \"{}\"",
        original, suggested
    ))
    .with_label(span)
    .with_help("Use sentence case (capitalize only the first word) for button text")
}

#[test]
fn test() {
    use oxc_linter::tester::Tester;

    let pass = vec![
        // Sentence case is fine
        r#"<Button>{t('Delete dataset')}</Button>"#,
        r#"{ confirmButtonText: t('Save changes') }"#,
        r#"{ primaryButtonName: t('Create chart') }"#,
        // Not in button context
        r#"t('Delete Dataset')"#,
        // Single word is fine
        r#"<Button>{t('Delete')}</Button>"#,
        // Not title case pattern
        r#"<Button>{t('DELETE DATASET')}</Button>"#,
    ];

    let fail = vec![
        r#"<Button>{t('Delete Dataset')}</Button>"#,
        r#"{ confirmButtonText: t('Save Changes') }"#,
        r#"{ primaryButtonName: t('Create New Chart') }"#,
        r#"{ cancelButtonText: t('Cancel Operation') }"#,
    ];

    Tester::new(SentenceCaseButtonsRule::NAME, pass, fail).test();
}
