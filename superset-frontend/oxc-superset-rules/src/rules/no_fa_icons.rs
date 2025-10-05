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

#[derive(Debug, Default, Clone)]
pub struct NoFaIconsRule;

declare_oxc_lint!(
    /// ### What it does
    /// Prevents the usage of FontAwesome icons in JSX
    ///
    /// ### Why is this bad?
    /// Superset has a custom Icons component that should be used instead of FontAwesome
    /// for consistency and bundle size optimization.
    ///
    /// ### Example
    /// ```jsx
    /// // Bad
    /// <i className="fa fa-check" />
    ///
    /// // Good
    /// import { Icons } from 'src/components/Icons';
    /// <Icons.Check />
    /// ```
    NoFaIconsRule,
    style
);

impl Rule for NoFaIconsRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::JSXOpeningElement(element) = node.kind() {
            // Check if it's an <i> element
            if !is_i_element(element) {
                return;
            }

            // Check for FontAwesome class names
            if let Some(class_attr) = find_class_attribute(element) {
                if is_fontawesome_class(class_attr) {
                    ctx.diagnostic(no_fa_icons_diagnostic(element.span));
                }
            }
        }
    }
}

fn is_i_element(element: &JSXOpeningElement) -> bool {
    matches!(
        &element.name,
        JSXElementName::Identifier(ident) if ident.name == "i"
    )
}

fn find_class_attribute<'a>(element: &'a JSXOpeningElement) -> Option<&'a JSXAttribute> {
    element.attributes.iter().find_map(|attr| {
        if let JSXAttributeItem::Attribute(attribute) = attr {
            if let JSXAttributeName::Identifier(ident) = &attribute.name {
                if ident.name == "className" {
                    return Some(attribute);
                }
            }
        }
        None
    })
}

fn is_fontawesome_class(attr: &JSXAttribute) -> bool {
    if let Some(JSXAttributeValue::StringLiteral(lit)) = &attr.value {
        let class_value = lit.value.as_str();
        // Check for FontAwesome patterns: "fa ", "fa-", "fas ", "far ", "fab "
        class_value.contains("fa ")
            || class_value.contains("fa-")
            || class_value.contains("fas ")
            || class_value.contains("far ")
            || class_value.contains("fab ")
    } else {
        false
    }
}

fn no_fa_icons_diagnostic(span: Span) -> OxcDiagnostic {
    OxcDiagnostic::warn("FontAwesome icons should not be used")
        .with_label(span)
        .with_help("Use the src/components/Icons component instead")
}

#[test]
fn test() {
    use oxc_linter::tester::Tester;

    let pass = vec![
        r#"<i className="other-icon" />"#,
        r#"<span className="fa fa-check" />"#,
        r#"<Icons.Check />"#,
        r#"<div className="some-class" />"#,
    ];

    let fail = vec![
        r#"<i className="fa fa-check" />"#,
        r#"<i className="fas fa-user" />"#,
        r#"<i className="far fa-calendar" />"#,
        r#"<i className="fab fa-github" />"#,
    ];

    Tester::new(NoFaIconsRule::NAME, pass, fail).test();
}
