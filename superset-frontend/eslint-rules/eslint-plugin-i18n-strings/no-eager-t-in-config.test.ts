/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { Rule } from 'eslint';

const { RuleTester } = require('eslint');
const plugin: { rules: Record<string, Rule.RuleModule> } = require('.');

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
});
const rule: Rule.RuleModule = plugin.rules['no-eager-t-in-config'];

ruleTester.run('no-eager-t-in-config', rule, {
  valid: [
    // Lazy form — the recommended pattern
    "const c = { label: () => t('Foo') };",
    "const c = { description: () => t('Foo') };",
    "const c = { label: () => tn('one', 'many', n) };",
    // Static strings — no translation, no issue
    "const c = { label: 'Foo' };",
    // Other property names — unaffected
    "const c = { name: t('Foo') };",
    "const c = { title: t('Foo') };",
    // Computed keys are too dynamic to lint usefully
    "const c = { [labelKey]: t('Foo') };",
    // Shorthand: `{ label }` — no value to inspect
    'const label = t("Foo"); const c = { label };',
    // t() called inside a function body — already lazy
    "const c = { label: state => t('Foo') };",
    // Non-t() call expressions are fine
    "const c = { label: someOtherFn('Foo') };",
  ],
  invalid: [
    {
      code: "const c = { label: t('Foo') };",
      output: "const c = { label: () => t('Foo') };",
      errors: [{ messageId: 'eager' }],
    },
    {
      code: "const c = { description: t('Foo bar') };",
      output: "const c = { description: () => t('Foo bar') };",
      errors: [{ messageId: 'eager' }],
    },
    {
      code: "const c = { label: tn('one', 'many', 2) };",
      output: "const c = { label: () => tn('one', 'many', 2) };",
      errors: [{ messageId: 'eager' }],
    },
    // String-literal keys are equivalent to identifier keys
    {
      code: "const c = { 'label': t('Foo') };",
      output: "const c = { 'label': () => t('Foo') };",
      errors: [{ messageId: 'eager' }],
    },
    // Custom watched-property list via rule option
    {
      code: "const c = { headerTitle: t('Foo') };",
      output: "const c = { headerTitle: () => t('Foo') };",
      options: [{ properties: ['headerTitle'] }],
      errors: [{ messageId: 'eager' }],
    },
    // Nested config — fires per occurrence
    {
      code: "const c = { foo: { label: t('A'), description: t('B') } };",
      output:
        "const c = { foo: { label: () => t('A'), description: () => t('B') } };",
      errors: [{ messageId: 'eager' }, { messageId: 'eager' }],
    },
  ],
});
