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

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { Loading } from '@superset-ui/core/components';
import { findPageByPath, resolvePage, usePages } from 'src/core/pages';
import ExtensionsLoader from 'src/extensions/ExtensionsLoader';
import { stripAppRoot } from 'src/utils/navigationUtils';
import { ErrorAlert } from 'src/components/ErrorMessage/ErrorAlert';

/**
 * Renders whichever extension page claims the current URL.
 *
 * The server serves the application shell for every path under the extension
 * namespace without knowing which pages exist -- that is what lets one route
 * cover every extension. The consequence is that deciding a URL is genuinely
 * unclaimed happens here, and it can only be decided once extensions have
 * finished loading. Until then this must not say "not found", because the
 * page may be moments away.
 */
export default function ExtensionPage() {
  const { pathname } = useLocation();
  // Subscribed rather than read once: an extension registering after this
  // first render is the normal case, not the exception.
  usePages();
  const [extensionsSettled, setExtensionsSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Resolves whether or not individual extensions failed; a failure to load
    // one extension still settles the question for every other path.
    ExtensionsLoader.getInstance()
      .initializeExtensions()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setExtensionsSettled(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const page = findPageByPath(stripAppRoot(pathname));

  if (page) {
    return resolvePage(`${page.extensionId}.${page.slug}`);
  }

  if (!extensionsSettled) {
    return <Loading />;
  }

  // Everything that can claim this path has had its chance.
  return (
    <ErrorAlert
      errorType={t('Page not found')}
      message={t('No extension provides a page at this address.')}
      description={t(
        'The extension may not be installed, or may have failed to load. ' +
          'Check the browser console and the Extensions screen.',
      )}
      type="warning"
      closable={false}
    />
  );
}
