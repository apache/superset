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
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs';
import { themes } from 'prism-react-renderer';
import remarkImportPartial from 'remark-import-partial';
import remarkLocalizeBadges from './plugins/remark-localize-badges.mjs';
import remarkTechArticleSchema from './plugins/remark-tech-article-schema.mjs';
import * as fs from 'fs';
import * as path from 'path';

const { github: lightCodeTheme, vsDark: darkCodeTheme } = themes;

// Load version configuration from external file
const versionsConfigPath = path.join(__dirname, 'versions-config.json');
const versionsConfig = JSON.parse(fs.readFileSync(versionsConfigPath, 'utf8'));

// Build plugins array dynamically based on disabled flags
const dynamicPlugins = [];

// Add components plugin if not disabled
if (!versionsConfig.components.disabled) {
  dynamicPlugins.push([
    '@docusaurus/plugin-content-docs',
    {
      id: 'components',
      path: 'components',
      routeBasePath: 'components',
      sidebarPath: require.resolve('./sidebarComponents.js'),
      editUrl:
        'https://github.com/apache/superset/edit/master/docs/components',
      remarkPlugins: [remarkImportPartial, remarkLocalizeBadges, remarkTechArticleSchema],
      admonitions: {
        keywords: ['note', 'tip', 'info', 'warning', 'danger', 'resources'],
        extendDefaults: true,
      },
      docItemComponent: '@theme/DocItem',
      includeCurrentVersion: versionsConfig.components.includeCurrentVersion,
      lastVersion: versionsConfig.components.lastVersion,
      onlyIncludeVersions: versionsConfig.components.onlyIncludeVersions,
      versions: versionsConfig.components.versions,
      disableVersioning: false,
      showLastUpdateAuthor: true,
      showLastUpdateTime: true,
    },
  ]);
}

// Add admin_docs plugin if not disabled
if (!versionsConfig.admin_docs.disabled) {
  dynamicPlugins.push([
    '@docusaurus/plugin-content-docs',
    {
      id: 'admin_docs',
      path: 'admin_docs',
      routeBasePath: 'admin-docs',
      sidebarPath: require.resolve('./sidebarAdminDocs.js'),
      editUrl:
        'https://github.com/apache/superset/edit/master/docs/admin_docs',
      remarkPlugins: [remarkImportPartial, remarkLocalizeBadges, remarkTechArticleSchema],
      admonitions: {
        keywords: ['note', 'tip', 'info', 'warning', 'danger', 'resources'],
        extendDefaults: true,
      },
      docItemComponent: '@theme/DocItem',
      includeCurrentVersion: versionsConfig.admin_docs.includeCurrentVersion,
      lastVersion: versionsConfig.admin_docs.lastVersion,
      onlyIncludeVersions: versionsConfig.admin_docs.onlyIncludeVersions,
      versions: versionsConfig.admin_docs.versions,
      disableVersioning: false,
      showLastUpdateAuthor: true,
      showLastUpdateTime: true,
    },
  ]);
}

// Add developer_docs plugin if not disabled
if (!versionsConfig.developer_docs.disabled) {
  dynamicPlugins.push([
    '@docusaurus/plugin-content-docs',
    {
      id: 'developer_docs',
      path: 'developer_docs',
      routeBasePath: 'developer-docs',
      sidebarPath: require.resolve('./sidebarTutorials.js'),
      editUrl:
        'https://github.com/apache/superset/edit/master/docs/developer_docs',
      remarkPlugins: [remarkImportPartial, remarkLocalizeBadges, remarkTechArticleSchema],
      admonitions: {
        keywords: ['note', 'tip', 'info', 'warning', 'danger', 'resources'],
        extendDefaults: true,
      },
      docItemComponent: '@theme/ApiItem', // Required for OpenAPI docs
      includeCurrentVersion: versionsConfig.developer_docs.includeCurrentVersion,
      lastVersion: versionsConfig.developer_docs.lastVersion,
      onlyIncludeVersions: versionsConfig.developer_docs.onlyIncludeVersions,
      versions: versionsConfig.developer_docs.versions,
      disableVersioning: false,
      showLastUpdateAuthor: true,
      showLastUpdateTime: true,
    },
  ]);
}

// Build navbar items dynamically based on disabled flags
const dynamicNavbarItems = [];

// Add Component Playground navbar item if not disabled
if (!versionsConfig.components.disabled) {
  dynamicNavbarItems.push({
    label: 'Component Playground',
    to: '/components',
    items: [
      {
        label: 'Introduction',
        to: '/components',
      },
      {
        label: 'UI Components',
        to: '/components/ui-components/button',
      },
      {
        label: 'Chart Components',
        to: '/components/chart-components/bar-chart',
      },
      {
        label: 'Layout Components',
        to: '/components/layout-components/grid',
      },
    ],
  });
}

// Add Admin Docs navbar item if not disabled
if (!versionsConfig.admin_docs.disabled) {
  dynamicNavbarItems.push({
    label: 'Admins',
    to: '/admin-docs/',
    position: 'left',
    activeBaseRegex: '^/admin-docs/',
    items: [
      {
        label: 'Overview',
        to: '/admin-docs/',
        activeBaseRegex: '^/admin-docs/$',
      },
      {
        label: 'Installation',
        to: '/admin-docs/installation/installation-methods',
        activeBaseRegex: '^/admin-docs/installation/',
      },
      {
        label: 'Configuration',
        to: '/admin-docs/configuration/configuring-superset',
        activeBaseRegex: '^/admin-docs/configuration/',
      },
      {
        label: 'Database Drivers',
        href: '/user-docs/databases/',
      },
      {
        label: 'Security',
        to: '/admin-docs/security/security',
        activeBaseRegex: '^/admin-docs/security/',
      },
    ],
  });
}

// Add Developer Docs navbar item if not hidden from nav
if (!versionsConfig.developer_docs.disabled && !versionsConfig.developer_docs.hideFromNav) {
  dynamicNavbarItems.push({
    label: 'Developers',
    to: '/developer-docs/',
    position: 'left',
    activeBaseRegex: '^/developer-docs/',
    items: [
      {
        label: 'Overview',
        to: '/developer-docs/',
        activeBaseRegex: '^/developer-docs/$',
      },
      {
        label: 'Contributing',
        to: '/developer-docs/contributing/overview',
        activeBaseRegex: '^/developer-docs/contributing/',
      },
      {
        label: 'Extensions',
        to: '/developer-docs/extensions/overview',
        activeBaseRegex: '^/developer-docs/extensions/',
      },
      {
        label: 'Testing',
        to: '/developer-docs/testing/overview',
        activeBaseRegex: '^/developer-docs/testing/',
      },
      {
        label: 'UI Components',
        to: '/developer-docs/components/',
        activeBaseRegex: '^/developer-docs/components/',
      },
      {
        label: 'API Reference',
        to: '/developer-docs/api',
        activeBaseRegex: '^/developer-docs/api',
      },
    ],
  });
}

// Docusaurus Faster: Rspack bundler, SWC transpilation, and other build
// optimizations. Only enabled for local development — CI runners (GitHub
// Actions, Netlify) have ~8GB RAM and these features push memory usage over
// the limit. See https://docusaurus.io/blog/releases/3.6#docusaurus-faster
const isCI = process.env.CI === 'true';

const config: Config = {
  ...(!isCI && {
    future: {
      v4: {
        removeLegacyPostBuildHeadAttribute: true,
        // Disabled: CSS cascade layers change specificity and cause antd
        // styles (from Storybook component pages) to override theme styles
        useCssCascadeLayers: false,
      },
      experimental_faster: {
        swcJsLoader: true,
        swcJsMinimizer: true,
        swcHtmlMinimizer: true,
        lightningCssMinimizer: true,
        rspackBundler: true,
        mdxCrossCompilerCache: true,
        rspackPersistentCache: true,
        // SSG worker threads spawn parallel Node processes, each consuming
        // significant memory. Disabled to keep total usage reasonable.
        ssgWorkerThreads: false,
      },
    },
  }),
  title: 'Superset',
  tagline:
    'Apache Superset is a modern data exploration and visualization platform',
  url: 'https://superset.apache.org',
  baseUrl: '/',
  onBrokenLinks: 'warn',
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },
  favicon: '/img/favicon.ico',
  organizationName: 'apache',
  projectName: 'superset',

  // SEO: Structured data (Organization, Software, WebSite with SearchAction)
  headTags: [
    // SoftwareApplication schema
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Apache Superset',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Cross-platform',
        description: 'Apache Superset is a modern, enterprise-ready business intelligence web application for data exploration and visualization.',
        url: 'https://superset.apache.org',
        license: 'https://www.apache.org/licenses/LICENSE-2.0',
        author: {
          '@type': 'Organization',
          name: 'Apache Software Foundation',
          url: 'https://www.apache.org/',
          logo: 'https://www.apache.org/foundation/press/kit/asf_logo.png',
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        featureList: [
          'Interactive dashboards',
          'SQL IDE',
          '40+ visualization types',
          'Semantic layer',
          'Role-based access control',
          'REST API',
        ],
      }),
    },
    // WebSite schema with SearchAction (enables sitelinks search box in Google)
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Apache Superset',
        url: 'https://superset.apache.org',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://superset.apache.org/search?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      }),
    },
    // Preconnect hints for faster external resource loading
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://WR5FASX5ED-dsn.algolia.net',
        crossorigin: 'anonymous',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://analytics.apache.org',
      },
    },
  ],
  themes: [
    '@saucelabs/theme-github-codeblock',
    '@docusaurus/theme-mermaid',
    '@docusaurus/theme-live-codeblock',
    'docusaurus-theme-openapi-docs',
  ],
  plugins: [
    require.resolve('./src/webpack.extend.ts'),
    ...dynamicPlugins,
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'developer_docs',
        config: {
          superset: {
            specPath: 'static/resources/openapi.json',
            outputDir: 'developer_docs/api',
            sidebarOptions: {
              groupPathsBy: 'tag',
              categoryLinkSource: 'tag',
              sidebarCollapsible: true,
              sidebarCollapsed: true,
            },
            showSchemas: true,
            hideSendButton: true,
            showInfoPage: false,
            showExtensions: true,
          } satisfies OpenApiPlugin.Options,
        },
      },
    ],
    // SEO: Generate robots.txt during build
    [
      require.resolve('./plugins/robots-txt-plugin.js'),
      {
        policies: [
          {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/v1/', '/_next/', '/static/js/*.map'],
          },
        ],
      },
    ],
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          // Legacy HTML page redirects
          {
            to: '/admin-docs/installation/docker-compose',
            from: '/installation.html',
          },
          {
            to: '/user-docs/',
            from: '/tutorials.html',
          },
          {
            to: '/user-docs/using-superset/creating-your-first-dashboard',
            from: '/admintutorial.html',
          },
          {
            to: '/user-docs/using-superset/creating-your-first-dashboard',
            from: '/usertutorial.html',
          },
          {
            to: '/admin-docs/security/',
            from: '/security.html',
          },
          {
            to: '/admin-docs/configuration/sql-templating',
            from: '/sqllab.html',
          },
          {
            to: '/user-docs/',
            from: '/gallery.html',
          },
          {
            to: '/user-docs/databases/',
            from: '/druid.html',
          },
          {
            to: '/admin-docs/configuration/country-map-tools',
            from: '/misc.html',
          },
          {
            to: '/admin-docs/configuration/country-map-tools',
            from: '/visualization.html',
          },
          {
            to: '/user-docs/faq',
            from: '/videos.html',
          },
          {
            to: '/user-docs/faq',
            from: '/faq.html',
          },
          {
            to: '/user-docs/using-superset/creating-your-first-dashboard',
            from: '/tutorial.html',
          },
          {
            to: '/user-docs/using-superset/creating-your-first-dashboard',
            from: '/docs/creating-charts-dashboards/first-dashboard',
          },
          {
            to: '/developer-docs/api',
            from: '/docs/rest-api',
          },
          {
            to: '/admin-docs/configuration/alerts-reports',
            from: '/docs/installation/alerts-reports',
          },
          {
            to: '/developer-docs/contributing/development-setup',
            from: '/docs/contributing/hooks-and-linting',
          },
          {
            to: '/user-docs/',
            from: '/docs/roadmap',
          },
          {
            to: '/user-docs/',
            from: '/user-docs/intro',
          },
          {
            to: '/developer-docs/contributing/overview',
            from: '/docs/contributing/contribution-guidelines',
          },
          {
            to: '/developer-docs/contributing/overview',
            from: '/docs/contributing/contribution-page',
          },
          {
            to: '/user-docs/databases/',
            from: '/docs/databases/yugabyte/',
          },
          {
            to: '/user-docs/faq',
            from: '/docs/frequently-asked-questions',
          },
          // Redirect old user-docs/api to developer-docs/api
          {
            to: '/developer-docs/api',
            from: '/user-docs/api',
          },
          // Redirects from old /docs/ paths to new /admin-docs/ paths
          {
            to: '/admin-docs/installation/installation-methods',
            from: '/docs/installation/installation-methods',
          },
          {
            to: '/admin-docs/installation/docker-compose',
            from: '/docs/installation/docker-compose',
          },
          {
            to: '/admin-docs/installation/docker-builds',
            from: '/docs/installation/docker-builds',
          },
          {
            to: '/admin-docs/installation/kubernetes',
            from: '/docs/installation/kubernetes',
          },
          {
            to: '/admin-docs/installation/pypi',
            from: '/docs/installation/pypi',
          },
          {
            to: '/admin-docs/installation/architecture',
            from: '/docs/installation/architecture',
          },
          {
            to: '/admin-docs/installation/upgrading-superset',
            from: '/docs/installation/upgrading-superset',
          },
          {
            to: '/admin-docs/configuration/configuring-superset',
            from: '/docs/configuration/configuring-superset',
          },
          {
            to: '/admin-docs/configuration/alerts-reports',
            from: '/docs/configuration/alerts-reports',
          },
          {
            to: '/admin-docs/configuration/async-queries-celery',
            from: '/docs/configuration/async-queries-celery',
          },
          {
            to: '/admin-docs/configuration/cache',
            from: '/docs/configuration/cache',
          },
          {
            to: '/admin-docs/configuration/event-logging',
            from: '/docs/configuration/event-logging',
          },
          {
            to: '/admin-docs/configuration/feature-flags',
            from: '/docs/configuration/feature-flags',
          },
          {
            to: '/admin-docs/configuration/sql-templating',
            from: '/docs/configuration/sql-templating',
          },
          {
            to: '/admin-docs/configuration/theming',
            from: '/docs/configuration/theming',
          },
          {
            to: '/admin-docs/security/',
            from: '/docs/security',
          },
          {
            to: '/admin-docs/security/',
            from: '/docs/security/security',
          },
          // Redirects from old /docs/contributing/ to Developer Portal
          {
            to: '/developer-docs/contributing/overview',
            from: '/docs/contributing',
          },
          {
            to: '/developer-docs/contributing/overview',
            from: '/docs/contributing/contributing',
          },
          {
            to: '/developer-docs/contributing/development-setup',
            from: '/docs/contributing/development',
          },
          {
            to: '/developer-docs/contributing/guidelines',
            from: '/docs/contributing/guidelines',
          },
          {
            to: '/developer-docs/contributing/howtos',
            from: '/docs/contributing/howtos',
          },
          {
            to: '/admin-docs/installation/kubernetes',
            from: '/docs/installation/running-on-kubernetes/',
          },
          {
            to: '/developer-docs/contributing/howtos',
            from: '/docs/contributing/testing-locally/',
          },
          {
            to: '/user-docs/using-superset/creating-your-first-dashboard',
            from: '/docs/creating-charts-dashboards/creating-your-first-dashboard/',
          },
          {
            to: '/user-docs/using-superset/creating-your-first-dashboard',
            from: '/docs/creating-charts-dashboards/exploring-data/',
          },
          {
            to: '/admin-docs/installation/docker-compose',
            from: '/docs/installation/installing-superset-using-docker-compose/',
          },
          {
            to: '/developer-docs/contributing/howtos',
            from: '/docs/contributing/creating-viz-plugins/',
          },
          {
            to: '/admin-docs/installation/kubernetes',
            from: '/docs/installation/',
          },
          {
            to: '/admin-docs/installation/pypi',
            from: '/docs/installation/installing-superset-from-pypi/',
          },
          {
            to: '/admin-docs/configuration/configuring-superset',
            from: '/docs/installation/configuring-superset/',
          },
          {
            to: '/admin-docs/configuration/cache',
            from: '/docs/installation/cache/',
          },
          {
            to: '/admin-docs/configuration/async-queries-celery',
            from: '/docs/installation/async-queries-celery/',
          },
          {
            to: '/admin-docs/configuration/event-logging',
            from: '/docs/installation/event-logging/',
          },
          {
            to: '/developer-docs/contributing/howtos',
            from: '/docs/contributing/translations/',
          },
          // Additional configuration redirects
          {
            to: '/admin-docs/configuration/country-map-tools',
            from: '/docs/configuration/country-map-tools',
          },
          {
            to: '/admin-docs/configuration/importing-exporting-datasources',
            from: '/docs/configuration/importing-exporting-datasources',
          },
          {
            to: '/admin-docs/configuration/map-tiles',
            from: '/docs/configuration/map-tiles',
          },
          {
            to: '/admin-docs/configuration/networking-settings',
            from: '/docs/configuration/networking-settings',
          },
          {
            to: '/admin-docs/configuration/timezones',
            from: '/docs/configuration/timezones',
          },
          // Additional security redirects
          {
            to: '/admin-docs/security/cves',
            from: '/docs/security/cves',
          },
          {
            to: '/admin-docs/security/securing_superset',
            from: '/docs/security/securing_superset',
          },
          // Additional contributing redirects
          {
            to: '/developer-docs/contributing/resources',
            from: '/docs/contributing/resources',
          },
          {
            to: '/developer-docs/contributing/howtos',
            from: '/docs/contributing/misc',
          },
          {
            to: '/developer-docs/contributing/overview',
            from: '/docs/contributing/pkg-resources-migration',
          },
        ],
        // Use createRedirects for pattern-based redirects
        createRedirects(existingPath) {
          const redirects = [];

          // Redirect all /developer_portal/* paths to /developer-docs/*
          if (existingPath.startsWith('/developer-docs/')) {
            redirects.push(existingPath.replace('/developer-docs/', '/developer_portal/'));
          }

          // Redirect all /docs/* paths to /user-docs/* for user documentation
          if (existingPath.startsWith('/user-docs/')) {
            redirects.push(existingPath.replace('/user-docs/', '/docs/'));
          }

          // Redirect /docs/api/* to /developer-docs/api/* (API moved to developer docs)
          if (existingPath.startsWith('/developer-docs/api')) {
            redirects.push(existingPath.replace('/developer-docs/', '/docs/'));
          }

          return redirects.length > 0 ? redirects : undefined;
        },
      },
    ],
  ],

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          routeBasePath: 'user-docs',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: ({ versionDocsDirPath, docPath }) => {
            if (docPath === 'intro.md') {
              return 'https://github.com/apache/superset/edit/master/README.md';
            }
            return `https://github.com/apache/superset/edit/master/docs/${versionDocsDirPath}/${docPath}`;
          },
          remarkPlugins: [remarkImportPartial, remarkLocalizeBadges, remarkTechArticleSchema],
          admonitions: {
            keywords: ['note', 'tip', 'info', 'warning', 'danger', 'resources'],
            extendDefaults: true,
          },
          includeCurrentVersion: versionsConfig.docs.includeCurrentVersion,
          lastVersion: versionsConfig.docs.lastVersion,  // Make 'next' the default
          onlyIncludeVersions: versionsConfig.docs.onlyIncludeVersions,
          versions: versionsConfig.docs.versions,
          disableVersioning: false,
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          docItemComponent: '@theme/DocItem',
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
        // SEO: Sitemap configuration with priorities
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
          createSitemapItems: async (params) => {
            const { defaultCreateSitemapItems, ...rest } = params;
            const items = await defaultCreateSitemapItems(rest);
            return items.map((item) => {
              // Boost priority for key pages
              if (item.url.endsWith('/user-docs/')) {
                return { ...item, priority: 1.0, changefreq: 'daily' };
              }
              if (item.url.includes('/user-docs/quickstart')) {
                return { ...item, priority: 0.9, changefreq: 'weekly' };
              }
              if (item.url.includes('/admin-docs/installation/')) {
                return { ...item, priority: 0.8, changefreq: 'weekly' };
              }
              if (item.url.includes('/user-docs/databases')) {
                return { ...item, priority: 0.8, changefreq: 'weekly' };
              }
              if (item.url.includes('/admin-docs/')) {
                return { ...item, priority: 0.8, changefreq: 'weekly' };
              }
              if (item.url.includes('/user-docs/faq')) {
                return { ...item, priority: 0.7, changefreq: 'monthly' };
              }
              if (item.url === 'https://superset.apache.org/') {
                return { ...item, priority: 1.0, changefreq: 'daily' };
              }
              return item;
            });
          },
        },
      } satisfies Options,
    ],
  ],

  themeConfig: {
    // SEO: OpenGraph and Twitter meta tags
    metadata: [
      { name: 'keywords', content: 'data visualization, business intelligence, BI, dashboards, SQL, analytics, open source, Apache, charts, reporting' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Apache Superset' },
      { property: 'og:image', content: 'https://superset.apache.org/img/superset-og-image.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: 'https://superset.apache.org/img/superset-og-image.png' },
      { name: 'twitter:site', content: '@ApacheSuperset' },
    ],
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
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
      options: {
        // Any Mermaid config options go here...
        maxTextSize: 100000,
      },
    },
    navbar: {
      logo: {
        alt: 'Superset Logo',
        src: '/img/superset-logo-horiz.svg',
        srcDark: '/img/superset-logo-horiz-dark.svg',
      },
      items: [
        // Users docs - mirrors sidebar structure
        {
          label: 'Users',
          to: '/user-docs/',
          position: 'left',
          activeBaseRegex: '^/user-docs/',
          items: [
            {
              label: 'Overview',
              to: '/user-docs/',
              activeBaseRegex: '^/user-docs/$',
            },
            {
              label: 'Quickstart',
              to: '/user-docs/quickstart',
            },
            {
              label: 'Using Superset',
              to: '/user-docs/using-superset/creating-your-first-dashboard',
              activeBaseRegex: '^/user-docs/using-superset/',
            },
            {
              label: 'Connecting to Databases',
              to: '/user-docs/databases/',
              activeBaseRegex: '^/user-docs/databases/',
            },
            {
              label: 'FAQ',
              to: '/user-docs/faq',
            },
          ],
        },
        ...dynamicNavbarItems,
        // Community section
        {
          label: 'Community',
          to: '/community',
          position: 'left',
          activeBaseRegex: '^/community',
          items: [
            {
              label: 'Resources',
              to: '/community',
              activeBaseRegex: '^/community$',
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
            {
              label: 'Community Calendar',
              href: '/community#superset-community-calendar',
            },
            {
              label: 'In the Wild',
              href: '/inTheWild',
            },
          ],
        },
        {
          href: '/user-docs/',
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
          <div class="footer__ci-services">
            <span>CI powered by</span>
            <a href="https://www.netlify.com/" target="_blank" rel="nofollow noopener noreferrer"><img src="/img/netlify.png" alt="Netlify" title="Netlify - Deploy Previews" /></a>
          </div>
          <p>Copyright © ${new Date().getFullYear()},
          The <a href="https://www.apache.org/" target="_blank" rel="noreferrer">Apache Software Foundation</a>,
          Licensed under the Apache <a href="https://apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer">License</a>.</p>
          <p><small>Apache Superset, Apache, Superset, the Superset logo, and the Apache feather logo are either registered trademarks or trademarks of The Apache Software Foundation. All other products or name brands are trademarks of their respective holders, including The Apache Software Foundation.
          <a href="https://www.apache.org/" target="_blank">Apache Software Foundation</a> resources</small></p>
          <img class="footer__divider" src="/img/community/line.png" alt="Divider" />
          <p>
            <small>
              <a href="/admin-docs/security/" target="_blank" rel="noreferrer">Security</a>&nbsp;|&nbsp;
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
    liveCodeBlock: {
      playgroundPosition: 'bottom',
    },
  } satisfies ThemeConfig,
  scripts: [
    // {
    //   src: 'https://www.bugherd.com/sidebarv2.js?apikey=enilpiu7bgexxsnoqfjtxa',
    //   async: true,
    // },
    {
      src: 'https://widget.kapa.ai/kapa-widget.bundle.js',
      async: true,
      'data-website-id': 'c6a8a8b8-3127-48f9-97a7-51e9e10d20d0',
      'data-project-name': 'Apache Superset',
      'data-project-color': '#FFFFFF',
      'data-project-logo':
        'https://superset.apache.org/img/superset-logo-icon-only.png',
      'data-modal-override-open-id': 'ask-ai-input',
      'data-modal-override-open-class': 'search-input',
      'data-modal-disclaimer':
        'This is a custom LLM for Apache Superset with access to all [documentation](superset.apache.org/docs/intro/), [GitHub Open Issues, PRs and READMEs](github.com/apache/superset).&#10;&#10;Companies deploy assistants like this ([built by kapa.ai](https://kapa.ai)) on docs via [website widget](https://docs.kapa.ai/integrations/website-widget) (Docker, Reddit), in [support forms](https://docs.kapa.ai/integrations/support-form-deflector) for ticket deflection (Monday.com, Mapbox), or as [Slack bots](https://docs.kapa.ai/integrations/slack-bot) with private sources.',
      'data-modal-example-questions':
        'How do I install Superset?,How can I contribute to Superset?',
      'data-button-text-color': 'rgb(81,166,197)',
      'data-modal-header-bg-color': '#ffffff',
      'data-modal-title-color': 'rgb(81,166,197)',
      'data-modal-title': 'Apache Superset AI',
      'data-modal-disclaimer-text-color': '#000000',
      'data-consent-required': 'true',
      'data-consent-screen-disclaimer':
        "By clicking \"I agree, let's chat\", you consent to the use of the AI assistant in accordance with kapa.ai's [Privacy Policy](https://www.kapa.ai/content/privacy-policy). This service uses reCAPTCHA, which requires your consent to Google's [Privacy Policy](https://policies.google.com/privacy) and [Terms of Service](https://policies.google.com/terms). By proceeding, you explicitly agree to both kapa.ai's and Google's privacy policies.",
    },
  ],
  customFields: {
    matomoUrl: 'https://analytics.apache.org',
    matomoSiteId: '22',
  },
};

export default config;
