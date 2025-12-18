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
import { useEffect } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// File extensions to track as downloads
const DOWNLOAD_EXTENSIONS = [
  'pdf', 'zip', 'tar', 'gz', 'tgz', 'bz2',
  'exe', 'dmg', 'pkg', 'deb', 'rpm',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'csv', 'json', 'yaml', 'yml',
];

// External domains to categorize for better analytics
const EXTERNAL_LINK_CATEGORIES = {
  'github.com': 'GitHub',
  'slack.com': 'Slack',
  'bit.ly': 'Slack', // Slack invite link
  'stackoverflow.com': 'Stack Overflow',
  'lists.apache.org': 'Mailing List',
  'preset.io': 'Preset',
  'kapa.ai': 'Kapa AI',
};

export default function Root({ children }) {
  const { siteConfig } = useDocusaurusContext();
  const { customFields } = siteConfig;

  useEffect(() => {
    const { matomoUrl, matomoSiteId } = customFields;

    if (typeof window !== 'undefined') {
      const devMode = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(window.location.hostname);

      // Initialize the _paq array
      window._paq = window._paq || [];

      // Configure the tracker before loading matomo.js
      window._paq.push(['enableHeartBeatTimer']);
      window._paq.push(['enableLinkTracking']);
      window._paq.push(['setTrackerUrl', `${matomoUrl}/matomo.php`]);
      window._paq.push(['setSiteId', matomoSiteId]);

      // Track downloads with custom extensions
      window._paq.push(['setDownloadExtensions', DOWNLOAD_EXTENSIONS.join('|')]);

      // Now load the matomo.js script
      const script = document.createElement('script');
      script.async = true;
      script.src = `${matomoUrl}/matomo.js`;
      document.head.appendChild(script);

      // Helper to track events
      const trackEvent = (category, action, name, value) => {
        if (devMode) {
          console.log('Matomo trackEvent:', { category, action, name, value });
        }
        window._paq.push(['trackEvent', category, action, name, value]);
      };

      // Helper to track site search
      const trackSiteSearch = (keyword, category, resultsCount) => {
        if (devMode) {
          console.log('Matomo trackSiteSearch:', { keyword, category, resultsCount });
        }
        window._paq.push(['trackSiteSearch', keyword, category, resultsCount]);
      };

      // Track external link clicks with categorization
      const handleLinkClick = (event) => {
        const link = event.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        try {
          const url = new URL(href, window.location.origin);

          // Skip internal links
          if (url.hostname === window.location.hostname) return;

          // Determine category based on domain
          let category = 'External Link';
          for (const [domain, cat] of Object.entries(EXTERNAL_LINK_CATEGORIES)) {
            if (url.hostname.includes(domain)) {
              category = cat;
              break;
            }
          }

          trackEvent('Outbound Link', category, href);
        } catch {
          // Invalid URL, skip tracking
        }
      };

      // Track Algolia search queries
      const setupAlgoliaTracking = () => {
        // Watch for Algolia search modal
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check for Algolia search input
                const searchInput = node.querySelector?.('.DocSearch-Input') ||
                                   (node.classList?.contains('DocSearch-Input') ? node : null);
                if (searchInput) {
                  let debounceTimer;
                  searchInput.addEventListener('input', (e) => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                      const query = e.target.value.trim();
                      if (query.length >= 3) {
                        const results = document.querySelectorAll('.DocSearch-Hit');
                        trackSiteSearch(query, 'Documentation', results.length);
                      }
                    }, 1000); // Debounce to avoid tracking every keystroke
                  });
                }
              }
            });
          });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        return observer;
      };

      // Track video plays
      const handleVideoPlay = (event) => {
        if (event.target.tagName === 'VIDEO') {
          const videoSrc = event.target.currentSrc || event.target.src || 'unknown';
          trackEvent('Video', 'Play', videoSrc);
        }
      };

      // Track CTA button clicks
      const handleCTAClick = (event) => {
        const button = event.target.closest('.get-started-button, .default-button-theme');
        if (button) {
          const buttonText = button.textContent?.trim() || 'Unknown';
          const href = button.getAttribute('href') || '';
          trackEvent('CTA', 'Click', `${buttonText} - ${href}`);
        }
      };

      // Handle route changes for SPA
      const handleRouteChange = () => {
        if (devMode) {
          console.log('Route changed to:', window.location.pathname);
        }

        setTimeout(() => {
          const currentTitle = document.title;
          const currentPath = window.location.pathname;

          if (devMode) {
            console.log('Tracking page view:', currentPath, currentTitle);
            window._paq.push(['setDomains', ['superset.apache.org']]);
            window._paq.push([
              'setCustomUrl',
              'https://superset.apache.org' + currentPath,
            ]);
          } else {
            window._paq.push(['setCustomUrl', currentPath]);
          }

          window._paq.push(['setReferrerUrl', window.location.href]);
          window._paq.push(['setDocumentTitle', currentTitle]);
          window._paq.push(['trackPageView']);
        }, 100);
      };

      // Set up Docusaurus route listeners
      const possibleEvents = [
        'docusaurus.routeDidUpdate',
        'docusaurusRouteDidUpdate',
        'routeDidUpdate',
      ];

      if (devMode) {
        console.log('Setting up Matomo tracking with enhanced features');
      }

      // Store handler references for proper cleanup
      const routeHandlers = possibleEvents.map(eventName => {
        const handler = () => {
          if (devMode) {
            console.log(`Docusaurus route update detected via ${eventName}`);
          }
          handleRouteChange();
        };
        document.addEventListener(eventName, handler);
        return { eventName, handler };
      });

      // Manual history tracking as fallback
      const originalPushState = window.history.pushState;
      window.history.pushState = function () {
        originalPushState.apply(this, arguments);
        handleRouteChange();
      };

      window.addEventListener('popstate', handleRouteChange);

      // Set up event listeners
      document.addEventListener('click', handleLinkClick);
      document.addEventListener('click', handleCTAClick);
      document.addEventListener('play', handleVideoPlay, true);

      // Set up Algolia tracking
      const algoliaObserver = setupAlgoliaTracking();

      // Initial page tracking
      handleRouteChange();

      // Cleanup
      return () => {
        routeHandlers.forEach(({ eventName, handler }) => {
          document.removeEventListener(eventName, handler);
        });

        if (originalPushState) {
          window.history.pushState = originalPushState;
          window.removeEventListener('popstate', handleRouteChange);
        }

        document.removeEventListener('click', handleLinkClick);
        document.removeEventListener('click', handleCTAClick);
        document.removeEventListener('play', handleVideoPlay, true);

        if (algoliaObserver) {
          algoliaObserver.disconnect();
        }
      };
    }
  }, []);

  return children;
}
