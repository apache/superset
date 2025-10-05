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

#![allow(clippy::self_named_module_files)]

mod rules;

pub use rules::{
    no_fa_icons::NoFaIconsRule,
    no_literal_colors::NoLiteralColorsRule,
    no_template_vars::NoTemplateVarsRule,
    sentence_case_buttons::SentenceCaseButtonsRule,
};

use oxc_linter::RuleCategory;

/// Register all Superset custom rules with OXC
pub fn register_rules() -> Vec<oxc_linter::RuleWithSeverity> {
    vec![
        NoFaIconsRule::rule().into(),
        NoLiteralColorsRule::rule().into(),
        NoTemplateVarsRule::rule().into(),
        SentenceCaseButtonsRule::rule().into(),
    ]
}

/// Get rule metadata for all Superset rules
pub fn get_rules_metadata() -> Vec<RuleMetadata> {
    vec![
        RuleMetadata {
            name: "superset/no-fa-icons",
            category: RuleCategory::Style,
            description: "Disallow FontAwesome icons, use Icons component instead",
        },
        RuleMetadata {
            name: "superset/no-literal-colors",
            category: RuleCategory::Style,
            description: "Enforce theme color variables over hardcoded colors",
        },
        RuleMetadata {
            name: "superset/no-template-vars",
            category: RuleCategory::Correctness,
            description: "Prevent variables in translation templates",
        },
        RuleMetadata {
            name: "superset/sentence-case-buttons",
            category: RuleCategory::Style,
            description: "Enforce sentence case for button text",
        },
    ]
}

pub struct RuleMetadata {
    pub name: &'static str,
    pub category: RuleCategory,
    pub description: &'static str,
}
