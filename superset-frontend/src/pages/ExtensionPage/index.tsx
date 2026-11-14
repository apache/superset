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
import { useParams } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';
import { findPageById, resolvePage, usePages } from 'src/core/pages';
import ExtensionsLoader from 'src/extensions/ExtensionsLoader';
import { ErrorAlert } from 'src/components/ErrorMessage/ErrorAlert';

/**
 * Renders whichever extension page claims the current URL.
 *
 * Mounted on the host's own `/extensions/pages/:pageId` route, so the id is
 * a route parameter and no host screen can be shadowed by it. Whether an
 * extension serves that id can only be decided once extensions have
 * finished loading, so until then this must not say "not found": the page
 * may be moments away.
 */
/** What a cold load of this id would have answered: 404. */
function NotFound() {
  return (
    <ErrorAlert
      errorType={t('Page not found')}
      message={t('No extension provides a page with this name.')}
      description={t(
        'The extension may not be installed, may be switched off, or may ' +
          'have failed to load. Check the browser console and the ' +
          'Extensions screen.',
      )}
      type="warning"
      closable={false}
    />
  );
}

/**
 * Whether this page is hidden because the feature it belongs to is off.
 *
 * `permitted` is one answer to two questions: the server leaves a page out
 * of the permitted set both when the user lacks the page's permission and
 * when the page's `featureFlag` is off, and those deserve opposite screens.
 * The flag is re-read here from `window.featureFlags`, the resolved map
 * served in the same bootstrap the server computed availability from.
 *
 * The two can still disagree for as long as a tab stays open: the bootstrap
 * is baked into the document at load while `permitted` comes from a
 * per-request call, so a flag switched off mid-session leaves the stale map
 * saying it is on, and this branch is not taken until the page is reloaded.
 *
 * A page's flag is an operator's `FEATURE_FLAGS` key, which need not be one
 * of Superset's own, hence the cast: `isFeatureEnabled` reads the map by
 * name and a key that is not in it is off, which is what the server decides
 * too.
 */
function hiddenByFeatureFlag(featureFlag?: string): boolean {
  return !!featureFlag && !isFeatureEnabled(featureFlag as FeatureFlag);
}

export default function ExtensionPage() {
  const { pageId } = useParams<{ pageId: string }>();
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

  // The id is the route's own parameter, so there is nothing to parse and
  // no precedence to resolve: either an extension registered this id or
  // nothing did.
  const page = findPageById(pageId);

  if (page && !page.permitted && hiddenByFeatureFlag(page.featureFlag)) {
    // Not a refusal: a cold load of this id answers 404, and the message
    // below would tell even an Admin to ask an administrator for a
    // permission the page may never have declared. Client-side arrival has
    // to answer what the URL itself answers.
    return <NotFound />;
  }

  if (page && !page.permitted) {
    // The server has already refused a cold load of this path with 403; this
    // is the client-side arrival, where saying so beats rendering the page's
    // chrome around data its own API calls will refuse one by one.
    return (
      <ErrorAlert
        errorType={t('Not authorized')}
        message={t('You do not have permission to open this page.')}
        description={t(
          'Ask an administrator to grant you the permission this page ' +
            'requires on the extension that provides it.',
        )}
        type="warning"
        closable={false}
      />
    );
  }

  if (page) {
    return resolvePage(page.id);
  }

  if (!extensionsSettled) {
    return <Loading />;
  }

  // Everything that can claim this id has had its chance.
  return <NotFound />;
}
