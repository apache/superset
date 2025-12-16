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

/**
 * Remark plugin to localize badge images from shields.io and similar services.
 *
 * This plugin downloads badge SVGs at build time and serves them locally,
 * avoiding external dependencies and caching issues with dynamic badges.
 *
 * Inspired by Apache Commons' fixshields.py approach.
 */

import { visit } from 'unist-util-visit';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Badge domains to localize (always localize all URLs from these domains)
const BADGE_DOMAINS = [
  'img.shields.io',
  'badge.fury.io',
  'codecov.io',
  'badgen.net',
  'nodei.co',
];

// Patterns for badge URLs on other domains (e.g., GitHub Actions badges)
const BADGE_PATH_PATTERNS = [
  /github\.com\/.*\/actions\/workflows\/.*\/badge\.svg/,
  /github\.com\/.*\/badge\.svg/,
];

// Cache for downloaded badges (persists across files in a single build)
const badgeCache = new Map();

// Track if we've already ensured the badges directory exists
let badgesDirCreated = false;

/**
 * Generate a stable filename for a badge URL
 */
function getBadgeFilename(url) {
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
  // Extract a readable name from the URL
  const urlPath = new URL(url).pathname;
  const readablePart = urlPath
    .replace(/^\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .slice(0, 40);
  return `${readablePart}_${hash}.svg`;
}

/**
 * Check if a URL is a badge we should localize
 */
function isBadgeUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    // Check if it's from a known badge domain
    if (BADGE_DOMAINS.some((domain) => parsed.hostname.includes(domain))) {
      return true;
    }
    // Check if it matches a badge path pattern
    return BADGE_PATH_PATTERNS.some((pattern) => pattern.test(url));
  } catch {
    return false;
  }
}

/**
 * Download a badge and return the local path
 */
async function downloadBadge(url, staticDir) {
  // Check cache first
  if (badgeCache.has(url)) {
    return badgeCache.get(url);
  }

  const badgesDir = path.join(staticDir, 'badges');

  // Ensure badges directory exists
  if (!badgesDirCreated) {
    fs.mkdirSync(badgesDir, { recursive: true });
    badgesDirCreated = true;
  }

  const filename = getBadgeFilename(url);
  const localPath = path.join(badgesDir, filename);
  const webPath = `/badges/${filename}`;

  // Check if already downloaded in a previous build
  if (fs.existsSync(localPath)) {
    badgeCache.set(url, webPath);
    return webPath;
  }

  console.log(`[remark-localize-badges] Downloading: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        // Some services need a user agent
        'User-Agent': 'Mozilla/5.0 (compatible; DocusaurusBuild/1.0)',
        Accept: 'image/svg+xml,image/*,*/*',
      },
      // Follow redirects
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const content = await response.text();

    // Validate it's actually an SVG or image
    if (
      !contentType.includes('svg') &&
      !contentType.includes('image') &&
      !content.trim().startsWith('<svg') &&
      !content.trim().startsWith('<?xml')
    ) {
      throw new Error(
        `Invalid content type: ${contentType}. Expected SVG image.`,
      );
    }

    // Write the badge to disk
    fs.writeFileSync(localPath, content, 'utf8');
    console.log(`[remark-localize-badges] Saved: ${filename}`);

    badgeCache.set(url, webPath);
    return webPath;
  } catch (error) {
    // Fail the build on badge download failure
    throw new Error(
      `[remark-localize-badges] Failed to download badge: ${url}\n` +
        `Error: ${error.message}\n` +
        `Build cannot continue with broken badges. Please fix the badge URL or remove it.`,
    );
  }
}

/**
 * The remark plugin factory
 */
export default function remarkLocalizeBadges(options = {}) {
  // __dirname equivalent for ES modules - use import.meta.url
  const currentDir = path.dirname(new URL(import.meta.url).pathname);
  const docsRoot = path.resolve(currentDir, '..');
  const staticDir = options.staticDir || path.join(docsRoot, 'static');


  return async function transformer(tree) {
    const promises = [];

    // Find all image nodes
    visit(tree, 'image', (node) => {
      if (isBadgeUrl(node.url)) {
        promises.push(
          downloadBadge(node.url, staticDir).then((localPath) => {
            node.url = localPath;
          }),
        );
      }
    });

    // Also handle HTML img tags in raw HTML or JSX
    visit(tree, ['html', 'jsx'], (node) => {
      if (!node.value) return;

      // Find img src attributes pointing to badge URLs
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      let match;

      while ((match = imgRegex.exec(node.value)) !== null) {
        const url = match[1];
        if (isBadgeUrl(url)) {
          promises.push(
            downloadBadge(url, staticDir).then((localPath) => {
              node.value = node.value.replace(url, localPath);
            }),
          );
        }
      }
    });

    // Also handle markdown link images: [![alt](img-url)](link-url)
    visit(tree, 'link', (node) => {
      if (node.children) {
        node.children.forEach((child) => {
          if (child.type === 'image' && isBadgeUrl(child.url)) {
            promises.push(
              downloadBadge(child.url, staticDir).then((localPath) => {
                child.url = localPath;
              }),
            );
          }
        });
      }
    });

    // Wait for all downloads to complete
    await Promise.all(promises);
  };
}
