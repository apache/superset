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

export default function Root({ children }) {
  const { siteConfig } = useDocusaurusContext();
  const { customFields } = siteConfig;

  useEffect(() => {
    const { matomoUrl, matomoSiteId } = customFields;

    if (typeof window !== 'undefined') {
      // Making testing easier, logging debug junk if we're in development
      const devMode = window.location.hostname === 'localhost' ? true : false;

      // Initialize the _paq array first
      window._paq = window._paq || [];

      // Configure the tracker before loading matomo.js
      window._paq.push(['enableHeartBeatTimer']);
      window._paq.push(['enableLinkTracking']);
      window._paq.push(['setTrackerUrl', `${matomoUrl}/matomo.php`]);
      window._paq.push(['setSiteId', matomoSiteId]);

      // Initial page view is handled by handleRouteChange

      // Now load the matomo.js script
      const script = document.createElement('script');
      script.async = true;
      script.src = `${matomoUrl}/matomo.js`;
      document.head.appendChild(script);

      // Handle route changes for SPA
      const handleRouteChange = () => {
        if (devMode) {
          console.log('Route changed to:', window.location.pathname);
        }

        // Short timeout to ensure the page has fully rendered
        setTimeout(() => {
          // Get the current page title from the document
          const currentTitle = document.title;
          const currentPath = window.location.pathname;

          // For testing: impersonate real domain - ONLY FOR DEVELOPMENT
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
        }, 100); // Increased delay to ensure page has fully rendered
      };

      // Try all possible Docusaurus events - they've changed between versions
      const possibleEvents = [
        'docusaurus.routeDidUpdate',
        'docusaurusRouteDidUpdate',
        'routeDidUpdate',
      ];

      if (devMode) {
        console.log('Setting up Docusaurus route listeners');
      }
      possibleEvents.forEach(eventName => {
        document.addEventListener(eventName, () => {
          if (devMode) {
            console.log(`Docusaurus route update detected via ${eventName}`);
          }
          handleRouteChange();
        });
      });

      // Also set up manual history tracking as fallback
      if (devMode) {
        console.log('Setting up manual history tracking as fallback');
      }
      const originalPushState = window.history.pushState;
      window.history.pushState = function () {
        originalPushState.apply(this, arguments);
        handleRouteChange();
      };

      window.addEventListener('popstate', handleRouteChange);

      // Initial page tracking
      handleRouteChange();

      return () => {
        // Cleanup listeners
        possibleEvents.forEach(eventName => {
          document.removeEventListener(eventName, handleRouteChange);
        });

        if (originalPushState) {
          window.history.pushState = originalPushState;
          window.removeEventListener('popstate', handleRouteChange);
        }
      };
    }
  }, []);

  return children;
}
