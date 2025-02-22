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

import type { Config } from '@docusaurus/types';
import type { Options, ThemeConfig } from '@docusaurus/preset-classic';
import { themes } from 'prism-react-renderer';

const { github: lightCodeTheme, vsDark: darkCodeTheme } = themes;

const config: Config = {
  title: 'Superset',
  tagline:
    'Apache Superset is a modern data exploration and visualization platform',
  url: 'https://superset.apache.org',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  favicon: '/img/favicon.ico',
  organizationName: 'apache',
  projectName: 'superset',
  themes: ['@saucelabs/theme-github-codeblock'],
  plugins: [
    [
      'docusaurus-plugin-less',
      {
        lessOptions: {
          javascriptEnabled: true,
        },
      },
    ],
    [
      '@docusaurus/plugin-client-redirects',
      {
        fromExtensions: ['html', 'htm'],
        toExtensions: ['exe', 'zip'],
        redirects: [
          {
            to: '/docs/installation/docker-compose',
            from: '/installation.html',
          },
          {
            to: '/docs/intro',
            from: '/tutorials.html',
          },
          {
            to: '/docs/using-superset/creating-your-first-dashboard',
            from: '/admintutorial.html',
          },
          {
            to: '/docs/using-superset/creating-your-first-dashboard',
            from: '/usertutorial.html',
          },
          {
            to: '/docs/security/',
            from: '/security.html',
          },
          {
            to: '/docs/configuration/sql-templating',
            from: '/sqllab.html',
          },
          {
            to: '/docs/intro',
            from: '/gallery.html',
          },
          {
            to: '/docs/configuration/databases',
            from: '/druid.html',
          },
          {
            to: '/docs/configuration/country-map-tools',
            from: '/misc.html',
          },
          {
            to: '/docs/configuration/country-map-tools',
            from: '/visualization.html',
          },
          {
            to: '/docs/faq',
            from: '/videos.html',
          },
          {
            to: '/docs/faq',
            from: '/faq.html',
          },
          {
            to: '/docs/using-superset/creating-your-first-dashboard',
            from: '/tutorial.html',
          },
          {
            to: '/docs/using-superset/creating-your-first-dashboard',
            from: '/docs/creating-charts-dashboards/first-dashboard',
          },
          {
            to: '/docs/api',
            from: '/docs/rest-api',
          },
          {
            to: '/docs/configuration/alerts-reports',
            from: '/docs/installation/alerts-reports',
          },
          {
            to: '/docs/contributing/development',
            from: '/docs/contributing/hooks-and-linting',
          },
          {
            to: '/docs/intro',
            from: '/docs/roadmap',
          },
          {
            to: '/docs/contributing/',
            from: '/docs/contributing/contribution-guidelines',
          },
          {
            to: '/docs/contributing/',
            from: '/docs/contributing/contribution-page',
          },
          {
            to: '/docs/configuration/databases',
            from: '/docs/databases/yugabyte/',
          },
          {
            to: '/docs/faq',
            from: '/docs/frequently-asked-questions',
          },
          {
            to: '/docs/installation/kubernetes',
            from: '/docs/installation/running-on-kubernetes/',
          },
          {
            to: '/docs/contributing/howtos',
            from: '/docs/contributing/testing-locally/',
          },
          {
            to: '/docs/using-superset/creating-your-first-dashboard',
            from: '/docs/creating-charts-dashboards/creating-your-first-dashboard/',
          },
          {
            to: '/docs/using-superset/creating-your-first-dashboard',
            from: '/docs/creating-charts-dashboards/exploring-data/',
          },
          {
            to: '/docs/installation/docker-compose',
            from: '/docs/installation/installing-superset-using-docker-compose/',
          },
          {
            to: '/docs/contributing/howtos',
            from: '/docs/contributing/creating-viz-plugins/',
          },
          {
            to: '/docs/installation/kubernetes',
            from: '/docs/installation/',
          },
          {
            to: '/docs/installation/pypi',
            from: '/docs/installation/installing-superset-from-pypi/',
          },
          {
            to: '/docs/configuration/configuring-superset',
            from: '/docs/installation/configuring-superset/',
          },
          {
            to: '/docs/configuration/cache',
            from: '/docs/installation/cache/',
          },
          {
            to: '/docs/configuration/async-queries-celery',
            from: '/docs/installation/async-queries-celery/',
          },
          {
            to: '/docs/configuration/event-logging',
            from: '/docs/installation/event-logging/',
          },
          {
            to: '/docs/contributing/howtos',
            from: '/docs/contributing/translations/',
          },
        ],
      },
    ],
  ],

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: ({ versionDocsDirPath, docPath }) => {
            if (docPath === 'intro.md') {
              return 'https://github.com/apache/superset/edit/master/README.md';
            }
            return `https://github.com/apache/superset/edit/master/docs/${versionDocsDirPath}/${docPath}`;
          },
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            'https://github.com/facebook/docusaurus/edit/main/website/blog/',
        },
        theme: {
          customCss: require.resolve('./src/styles/custom.css'),
        },
      } satisfies Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    algolia: {
      appId: 'WR5FASX5ED',
      apiKey: 'd0d22810f2e9b614ffac3a73b26891fe',
      indexName: 'superset-apache',
    },
    navbar: {
      logo: {
        alt: 'Superset Logo',
        src: '/img/superset-logo-horiz.svg',
        srcDark: '/img/superset-logo-horiz-dark.svg',
      },
      items: [
        {
          label: 'Documentation',
          to: '/docs/intro',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'FAQ',
              to: '/docs/faq',
            },
          ],
        },
        {
          label: 'Community',
          to: '/community',
          items: [
            {
              label: 'Resources',
              href: '/community',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/apache/superset',
            },
            {
              label: 'Slack',
              href: 'http://bit.ly/join-superset-slack',
            },
            {
              label: 'Mailing List',
              href: 'https://lists.apache.org/list.html?dev@superset.apache.org',
            },
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/apache-superset',
            },
          ],
        },
        {
          href: '/docs/intro',
          position: 'right',
          className: 'default-button-theme get-started-button',
          label: 'Get Started',
        },
        {
          href: 'https://github.com/apache/superset',
          position: 'right',
          className: 'github-button',
        },
      ],
    },
    footer: {
      links: [],
      copyright: `
          <div class="footer__applitools">
            We use &nbsp;<a href="https://applitools.com/" target="_blank" rel="nofollow"><img src="/img/applitools.png" title="Applitools" /></a>
          </div>
          <p>Copyright © ${new Date().getFullYear()},
          The <a href="https://www.apache.org/" target="_blank" rel="noreferrer">Apache Software Foundation</a>,
          Licensed under the Apache <a href="https://apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer">License</a>.</p>
          <p><small>Apache Superset, Apache, Superset, the Superset logo, and the Apache feather logo are either registered trademarks or trademarks of The Apache Software Foundation. All other products or name brands are trademarks of their respective holders, including The Apache Software Foundation.
          <a href="https://www.apache.org/" target="_blank">Apache Software Foundation</a> resources</small></p>
          <img class="footer__divider" src="/img/community/line.png" alt="Divider" />
          <p>
            <small>
              <a href="/docs/security/" target="_blank" rel="noreferrer">Security</a>&nbsp;|&nbsp;
              <a href="https://www.apache.org/foundation/sponsorship.html" target="_blank" rel="noreferrer">Donate</a>&nbsp;|&nbsp;
              <a href="https://www.apache.org/foundation/thanks.html" target="_blank" rel="noreferrer">Thanks</a>&nbsp;|&nbsp;
              <a href="https://apache.org/events/current-event" target="_blank" rel="noreferrer">Events</a>&nbsp;|&nbsp;
              <a href="https://apache.org/licenses/" target="_blank" rel="noreferrer">License</a>&nbsp;|&nbsp;
              <a href="https://privacy.apache.org/policies/privacy-policy-public.html" target="_blank" rel="noreferrer">Privacy</a>
            </small>
          </p>
          <!-- telemetry/analytics pixel: -->
          <img referrerPolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=39ae6855-95fc-4566-86e5-360d542b0a68" />
          `,
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
    },
    docs: {
      sidebar: {
        hideable: true,
      },
    },
  } satisfies ThemeConfig,
  scripts: [
    '/script/matomo.js',
    // {
    //   src: 'https://www.bugherd.com/sidebarv2.js?apikey=enilpiu7bgexxsnoqfjtxa',
    //   async: true,
    // },
  ],
};

export default config;
