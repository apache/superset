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
      label: 'Developer Portal Overview',
      id: 'index',
    },
    {
      type: 'category',
      label: 'Extensions',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Architecture',
          collapsed: true,
          items: [
            'architecture/overview',
            'advanced/extension-host',
          ],
        },
        {
          type: 'category',
          label: 'Get Started',
          collapsed: true,
          items: [
            'get-started/your-first-plugin',
            'get-started/your-first-extension',
            'get-started/plugin-anatomy',
            'get-started/wrapping-up',
          ],
        },
        {
          type: 'category',
          label: 'Extension Development',
          collapsed: true,
          items: [
            'guides/overview',
            'examples/sql-lab-extensions',
            'guides/command-palette',
            'guides/webviews',
            'guides/custom-editors',
            'guides/virtual-documents',
          ],
        },
        {
          type: 'category',
          label: 'API Reference',
          collapsed: true,
          items: [
            'api/frontend',
            'references/api',
            'references/contribution-points',
            'references/activation-events',
            'references/manifest',
          ],
        },
        {
          type: 'category',
          label: 'CLI Tools',
          collapsed: true,
          items: [
            'cli/overview',
          ],
        },
        {
          type: 'category',
          label: 'Plugin Capabilities',
          collapsed: true,
          items: [
            'capabilities/overview',
            'capabilities/common-capabilities',
            'capabilities/theming',
            'capabilities/extending-workbench',
          ],
        },
        {
          type: 'category',
          label: 'Visualization Plugins',
          collapsed: true,
          items: [
            'viz-plugins/overview',
            'viz-plugins/creating-viz-plugin',
            'viz-plugins/controls',
            'viz-plugins/transforming-data',
          ],
        },
        {
          type: 'category',
          label: 'Extension Testing',
          collapsed: true,
          items: [
            'testing/unit-testing',
            'testing/integration-testing',
            'testing/publishing',
          ],
        },
        {
          type: 'category',
          label: 'UX Guidelines',
          collapsed: true,
          items: [
            'ux/overview',
            'ux/design-principles',
            'ux/accessibility',
            'ux/best-practices',
          ],
        },
        {
          type: 'category',
          label: 'Advanced Topics',
          collapsed: true,
          items: [
            'advanced/overview',
            'advanced/remote-development',
            'advanced/proposed-api',
          ],
        },
        {
          type: 'category',
          label: 'References',
          collapsed: true,
          items: [
            'references/overview',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Testing',
      collapsed: false,
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
      label: 'Coding Guidelines',
      collapsed: false,
      items: [
        'guidelines/coding',
        'guidelines/typescript',
        'guidelines/python',
        'guidelines/react',
        'guidelines/sql',
        'guidelines/documentation',
      ],
    },
    {
      type: 'category',
      label: 'Contributing to Superset',
      collapsed: false,
      items: [
        'contributing/overview',
        'contributing/development-setup',
        'contributing/submitting-pr',
        'contributing/code-review',
        'contributing/issue-reporting',
        'contributing/release-process',
      ],
    },
  ],
};

module.exports = sidebars;
