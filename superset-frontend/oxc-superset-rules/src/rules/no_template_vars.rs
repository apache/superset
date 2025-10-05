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
pub struct NoTemplateVarsRule;

declare_oxc_lint!(
    /// ### What it does
    /// Prevents using template literals with variables in translation functions
    ///
    /// ### Why is this bad?
    /// Flask-babel is a static translation service that can't handle dynamic strings.
    /// Variables in translation templates will break the translation extraction process.
    ///
    /// ### Example
    /// ```js
    /// // Bad
    /// t(`Welcome ${username}!`)
    /// tn('singular', `Found ${count} items`, count)
    ///
    /// // Good
    /// t('Welcome!')
    /// tn('singular', 'Found items', count)
    /// ```
    NoTemplateVarsRule,
    correctness
);

impl Rule for NoTemplateVarsRule {
    fn run<'a>(&self, node: &AstNode<'a>, ctx: &LintContext<'a>) {
        if let AstKind::CallExpression(call_expr) = node.kind() {
            // Check if this is a translation function call
            if !is_translation_function(&call_expr.callee) {
                return;
            }

            // Check first argument for template literals with expressions
            if let Some(first_arg) = call_expr.arguments.first() {
                if let Argument::TemplateLiteral(template) = &first_arg {
                    if !template.expressions.is_empty() {
                        ctx.diagnostic(no_template_vars_diagnostic(call_expr.span));
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

fn no_template_vars_diagnostic(span: Span) -> OxcDiagnostic {
    OxcDiagnostic::warn("Don't use variables in translation string templates")
        .with_label(span)
        .with_help(
            "Flask-babel is a static translation service, \
             so it can't handle strings that include variables. \
             Use placeholders or split the translation instead."
        )
}

#[test]
fn test() {
    use oxc_linter::tester::Tester;

    let pass = vec![
        r#"t('Hello world')"#,
        r#"t("Welcome to Superset")"#,
        r#"tn('singular', 'plural', count)"#,
        r#"someOtherFunction(`Template ${with} variables`)"#,
        r#"const message = `Welcome ${user}`"#,
    ];

    let fail = vec![
        r#"t(`Hello ${name}`)"#,
        r#"t(`Welcome ${user}!`)"#,
        r#"tn('singular', `Found ${count} items`, count)"#,
        r#"t(`The value is ${value}`)"#,
    ];

    Tester::new(NoTemplateVarsRule::NAME, pass, fail).test();
}
