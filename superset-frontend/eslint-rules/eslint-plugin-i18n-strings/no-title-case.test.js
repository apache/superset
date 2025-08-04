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

const { RuleTester } = require('eslint');
const plugin = require('./index');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 6,
  },
});

const rule = plugin.rules['no-title-case'];

ruleTester.run('no-title-case', rule, {
  valid: [
    // Sentence case (correct)
    {
      code: "t('Add a divider')",
    },
    {
      code: "t('Create new dashboard')",
    },
    {
      code: "t('Save and continue')",
    },
    // Single words
    {
      code: "t('Save')",
    },
    {
      code: "t('Delete')",
    },
    // All uppercase (acronyms)
    {
      code: "t('SQL')",
    },
    {
      code: "t('API KEY')",
    },
    // With placeholders
    {
      code: "t('Deleted: %s', name)",
    },
    {
      code: "t('User %(username)s added', { username })",
    },
    // Template literals without expressions
    {
      code: 't(`Add a new filter`)',
    },
    // Mixed case but not title case
    {
      code: "t('Use SQL Lab')",
    },
    // tn function
    {
      code: "tn('Add a filter', 'Add filters', count)",
    },
    // Multiple sentences with period
    {
      code: "t('Welcome Back. Please Login.')",
    },
    {
      code: "t('Save Changes. This Will Update All Records.')",
    },
  ],
  invalid: [
    // Title case (incorrect)
    {
      code: "t('Add Divider')",
      errors: [
        {
          message:
            'Avoid title case in i18n strings: "Add Divider". Use sentence case instead.',
        },
      ],
    },
    {
      code: "t('Create New Dashboard')",
      errors: [
        {
          message:
            'Avoid title case in i18n strings: "Create New Dashboard". Use sentence case instead.',
        },
      ],
    },
    {
      code: "t('Save And Continue')",
      errors: [
        {
          message:
            'Avoid title case in i18n strings: "Save And Continue". Use sentence case instead.',
        },
      ],
    },
    {
      code: "t('Add Filter')",
      errors: [
        {
          message:
            'Avoid title case in i18n strings: "Add Filter". Use sentence case instead.',
        },
      ],
    },
    {
      code: "t('Edit User')",
      errors: [
        {
          message:
            'Avoid title case in i18n strings: "Edit User". Use sentence case instead.',
        },
      ],
    },
    // Template literals
    {
      code: 't(`Add Layer`)',
      errors: [
        {
          message:
            'Avoid title case in i18n strings: "Add Layer". Use sentence case instead.',
        },
      ],
    },
    // tn function
    {
      code: "tn('Delete Item', 'Delete Items', count)",
      errors: [
        {
          message:
            'Avoid title case in i18n strings: "Delete Item". Use sentence case instead.',
        },
      ],
    },
  ],
});
