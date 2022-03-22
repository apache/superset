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
  onBrokenMarkdownLinks: 'throw',
  favicon: 'img/favicon.ico',
  organizationName: 'apache', // Usually your GitHub org/user name.
  projectName: 'superset', // Usually your repo name.
  themes: ['@saucelabs/theme-github-codeblock'],
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
            to: '/docs/creating-charts-dashboards/creating-your-first-dashboard',
            from: '/admintutorial.html',
          },
          {
            to: '/docs/creating-charts-dashboards/creating-your-first-dashboard',
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
            to: '/docs/intro',
            from: '/gallery.html',
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
            to: '/docs/creating-charts-dashboards/creating-your-first-dashboard',
            from: '/tutorial.html',
          },
          {
            to: '/docs/creating-charts-dashboards/creating-your-first-dashboard',
            from: '/docs/creating-charts-dashboards/first-dashboard',
          },
          {
            to: '/docs/api',
            from: '/docs/rest-api',
          },
          {
            to: '/docs/installation/alerts-reports',
            from: '/docs/installation/email-reports',
          },
          {
            to: '/docs/intro',
            from: '/docs/roadmap',
          },
          {
            to: '/docs/contributing/contributing-page',
            from: '/docs/contributing/contribution-guidelines',
          },
          {
            to: '/docs/databases/yugabytedb',
            from: '/docs/databases/yugabyte/',
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
          editUrl: 'https://github.com/apache/superset/tree/master/docs',
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
        googleAnalytics: {
          trackingID: 'G-133LHD3B3N',
          anonymizeIP: true,
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
      algolia: {
        appId: 'WR5FASX5ED',
        apiKey: '299e4601d2fc5d0031bf9a0223c7f0c5',
        indexName: 'superset-apache',
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
          { to: '/community', label: 'Community', position: 'left' },
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
                href: 'https://stackoverflow.com/questions/tagged/superset+apache-superset',
              },
              {
                label: 'Slack',
                href: 'https://join.slack.com/t/apache-superset/shared_invite/zt-uxbh5g36-AISUtHbzOXcu0BIj7kgUaw',
              },
              {
                label: 'Mailing List',
                href: 'https://lists.apache.org/list.html?dev@superset.apache.org',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/apache/superset',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()},
        The <a href="https://www.apache.org/" target="_blank" rel="noreferrer">Apache Software Foundation</a>,
        Licensed under the Apache <a href="https://apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer">License</a>. <br/>
        <small>Apache Superset, Apache, Superset, the Superset logo, and the Apache feather logo are either registered trademarks or trademarks of The Apache Software Foundation. All other products or name brands are trademarks of their respective holders, including The Apache Software Foundation.
        <a href="https://www.apache.org/" target="_blank">Apache Software Foundation</a> resources</small><br />
        <small>
        <a href="https://www.apache.org/security/" target="_blank" rel="noreferrer">Security</a>&nbsp;|&nbsp;
        <a href="https://www.apache.org/foundation/sponsorship.html" target="_blank" rel="noreferrer">Donate</a>&nbsp;|&nbsp;
        <a href="https://www.apache.org/foundation/thanks.html" target="_blank" rel="noreferrer">Thanks</a>&nbsp;|&nbsp;
        <a href="https://apache.org/events/current-event" target="_blank" rel="noreferrer">Events</a>&nbsp;|&nbsp;
        <a href="https://apache.org/licenses/" target="_blank" rel="noreferrer">License</a>
        </small>`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
