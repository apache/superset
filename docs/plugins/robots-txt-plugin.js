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

const fs = require('fs');
const path = require('path');

/**
 * Docusaurus plugin to generate robots.txt during build
 * Configuration is passed via plugin options
 */
module.exports = function robotsTxtPlugin(context, options) {
  const { siteConfig } = context;
  const {
    policies = [{ userAgent: '*', allow: '/' }],
    additionalSitemaps = [],
  } = options;

  return {
    name: 'robots-txt-plugin',

    async postBuild({ outDir }) {
      const sitemapUrl = `${siteConfig.url}/sitemap.xml`;

      // Build robots.txt content
      const lines = [];

      // Add policies
      for (const policy of policies) {
        lines.push(`User-agent: ${policy.userAgent}`);

        if (policy.allow) {
          const allows = Array.isArray(policy.allow) ? policy.allow : [policy.allow];
          for (const allow of allows) {
            lines.push(`Allow: ${allow}`);
          }
        }

        if (policy.disallow) {
          const disallows = Array.isArray(policy.disallow) ? policy.disallow : [policy.disallow];
          for (const disallow of disallows) {
            lines.push(`Disallow: ${disallow}`);
          }
        }

        if (policy.crawlDelay) {
          lines.push(`Crawl-delay: ${policy.crawlDelay}`);
        }

        lines.push(''); // Empty line between policies
      }

      // Add sitemaps
      lines.push(`Sitemap: ${sitemapUrl}`);
      for (const sitemap of additionalSitemaps) {
        lines.push(`Sitemap: ${sitemap}`);
      }

      // Write robots.txt
      const robotsPath = path.join(outDir, 'robots.txt');
      fs.writeFileSync(robotsPath, lines.join('\n'));

      console.log('Generated robots.txt');
    },
  };
};
