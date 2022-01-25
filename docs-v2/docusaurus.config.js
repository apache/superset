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
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Superset',
  tagline:
    'Apache Superset is a modern data exploration and visualization platform',
  url: 'https://superset.apache.org',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'apache', // Usually your GitHub org/user name.
  projectName: 'superset', // Usually your repo name.
   plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        fromExtensions: ['html', 'htm'],
        toExtensions: ['exe', 'zip'],
        redirects: [
          {
            to: '/docs/installation/installing-superset-using-docker-compose',
            from: '/installation.html',
          },
          {
            to: '/docs/intro',
            from: '/tutorials.html',
          },
          {
            to: '/docs/creating-charts-dashboards/first-dashboard',
            from: '/admintutorial.html',
          },
          {
            to: '/docs/creating-charts-dashboards/first-dashboard',
            from: '/usertutorial.html',
          },
          {
            to: '/docs/security',
            from: '/security.html',
          },
          {
            to: '/docs/installation/sql-templating',
            from: '/sqllab.html',
          },
          {
            to: '/docs/installation/sql-templating',
            from: '/gallery.html',
          },
          {
            to: '/docs/intro',
            from: '/sqllab.html',
          },
          {
            to: '/docs/databases/druid',
            from: '/druid.html',
          },
          {
            to: '/docs/miscellaneous/country-map-tools',
            from: '/misc.html',
          },
          {
            to: '/docs/miscellaneous/country-map-tools',
            from: '/visualization.html',
          },
          {
            to: '/docs/frequently-asked-questions',
            from: '/videos.html',
          },
          {
            to: '/docs/frequently-asked-questions',
            from: '/faq.html',
          },
          {
            to: '/docs/intro',
            from: '/index.html',
          },
          {
            to: '/docs/creating-charts-dashboards',
            from: '/tutorial.html',
          },
          {
            to: '/docs/installation/alerts-reports',
            from: '/docs/installation/email-reports',
          },
        ],
      },
    ],
  ],

  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl: 'https://github.com/facebook/docusaurus/edit/main/website/',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            'https://github.com/facebook/docusaurus/edit/main/website/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: true,
      },
      navbar: {
        logo: {
          alt: 'Superset Logo',
          src: 'img/superset-logo-horiz.svg',
          srcDark: 'img/superset-logo-horiz-dark.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'intro',
            position: 'left',
            label: 'Documentation',
          },
          { to: '/gallery', label: 'Gallery', position: 'left' },
          { to: '/community', label: 'Community', position: 'left' },
          { to: '/resources', label: 'Resources', position: 'left' },
          {
            href: 'https://github.com/apache/superset',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial',
                to: '/docs/intro',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/docusaurus',
              },
              {
                label: 'Discord',
                href: 'https://discordapp.com/invite/docusaurus',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/docusaurus',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/facebook/docusaurus',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),


};

module.exports = config;
