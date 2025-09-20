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
  TutorialsSidebar: [
    {
      type: 'doc',
      label: 'Overview',
      id: 'index',
    },
    {
      type: 'category',
      label: 'GET STARTED',
      collapsed: false,
      items: [
        'get-started/your-first-plugin',
        'get-started/plugin-anatomy',
        'get-started/wrapping-up',
      ],
    },
    {
      type: 'category',
      label: 'PLUGIN CAPABILITIES',
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
      label: 'PLUGIN GUIDES',
      collapsed: true,
      items: [
        'guides/overview',
        'guides/command-palette',
        'guides/webviews',
        'guides/custom-editors',
        'guides/virtual-documents',
      ],
    },
    {
      type: 'category',
      label: 'UX GUIDELINES',
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
      label: 'VISUALIZATION PLUGINS',
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
      label: 'TESTING AND PUBLISHING',
      collapsed: true,
      items: [
        'testing/overview',
        'testing/unit-testing',
        'testing/integration-testing',
        'testing/publishing',
      ],
    },
    {
      type: 'category',
      label: 'ADVANCED TOPICS',
      collapsed: true,
      items: [
        'advanced/overview',
        'advanced/extension-host',
        'advanced/remote-development',
        'advanced/proposed-api',
      ],
    },
    {
      type: 'category',
      label: 'REFERENCES',
      collapsed: true,
      items: [
        'references/overview',
        'references/api',
        'references/contribution-points',
        'references/activation-events',
        'references/manifest',
      ],
    },
  ],
};

module.exports = sidebars;
