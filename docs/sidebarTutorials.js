/* eslint-env node */
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

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  DeveloperPortalSidebar: [
    {
      type: 'doc',
      label: 'Overview',
      id: 'index',
    },
    {
      type: 'category',
      label: 'Extensions',
      collapsed: true,
      items: [
        'extensions/overview',
        'extensions/architectural-principles',
        'extensions/high-level-architecture',
        'extensions/extension-project-structure',
        'extensions/extension-metadata',
        'extensions/frontend-contribution-types',
        'extensions/interacting-with-host',
        'extensions/dynamic-module-loading',
        'extensions/deploying-extension',
        'extensions/lifecycle-management',
        'extensions/development-mode',
        'extensions/versioning',
        'extensions/security-implications',
        {
          type: 'doc',
          id: 'extensions/built-in-features',
          customProps: {
            disabled: true,
          },
        },
        'extensions/proof-of-concept',
      ],
    },
    {
      type: 'category',
      label: 'Testing',
      collapsed: true,
      items: [
        'testing/overview',
        'testing/frontend-testing',
        'testing/backend-testing',
        'testing/e2e-testing',
        'testing/ci-cd',
      ],
    },
    {
      type: 'category',
      label: 'Contributing to Superset',
      collapsed: true,
      items: [
        'contributing/overview',
        'contributing/development-setup',
        'contributing/submitting-pr',
        'contributing/guidelines',
        'contributing/code-review',
        'contributing/issue-reporting',
        'contributing/howtos',
        'contributing/release-process',
        'contributing/resources',
        {
          type: 'category',
          label: 'Contribution Guidelines',
          collapsed: true,
          items: [
            'guidelines/design-guidelines',
            {
              type: 'category',
              label: 'Frontend Style Guidelines',
              collapsed: true,
              items: [
                'guidelines/frontend-style-guidelines',
                'guidelines/frontend/component-style-guidelines',
                'guidelines/frontend/emotion-styling-guidelines',
                'guidelines/frontend/testing-guidelines',
              ],
            },
            {
              type: 'category',
              label: 'Backend Style Guidelines',
              collapsed: true,
              items: [
                'guidelines/backend-style-guidelines',
                'guidelines/backend/dao-style-guidelines',
              ],
            },
          ],
        },
      ],
    },
  ],
};

module.exports = sidebars;
