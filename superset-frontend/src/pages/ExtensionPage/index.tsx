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

import { cloneElement, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { Loading } from '@superset-ui/core/components';
import {
  getViewOptions,
  resolveView,
  useViews,
  PAGE_LOCATION,
} from 'src/core/views';
import ExtensionsLoader from 'src/extensions/ExtensionsLoader';
import { ErrorAlert } from 'src/components/ErrorMessage/ErrorAlert';
import { findPermission } from 'src/utils/findPermission';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

/**
 * Renders whichever extension page claims the current URL.
 *
 * Mounted on the host's own `/extensions/pages/:pageId` route, so the id is
 * a route parameter and no host screen can be shadowed by it. Whether an
 * extension serves that id can only be decided once extensions have
 * finished loading, so until then this must not say "not found": the page
 * may be moments away.
 *
 * The server answers every page id with the shell, so this component owns
 * all three answers -- the page, "not authorized", and "not found".
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

export default function ExtensionPage() {
  const { pageId } = useParams<{ pageId: string }>();
  // Subscribed rather than read once: an extension registering after this
  // first render is the normal case, not the exception. The subscription is
  // what makes the permission check happen the moment a page registers.
  const registered = useViews(PAGE_LOCATION);
  const roles = useSelector(
    (state: { user?: UserWithPermissionsAndRoles }) => state.user?.roles,
  );
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
  const page = registered?.find(view => view.id === pageId);

  if (!page) {
    // Deliberately not folded in with the permission check below. They
    // happen to be reached the same way -- nothing to render -- but they
    // answer different questions, and a page that registered without naming
    // a permission must render, not refuse.
    return extensionsSettled ? <NotFound /> : <Loading />;
  }

  const options = getViewOptions(pageId);
  const needed = options?.methodPermissionName
    ? `can_${options.methodPermissionName}`
    : undefined;

  if (needed && options?.classPermissionName) {
    // Read from the permissions this page's own shell already shipped --
    // `bootstrap_user_data(include_perms=True)` -- so there is nothing to
    // fetch and nothing that can disagree with the server: this is the same
    // permission the page's endpoints check, not a parallel one.
    if (!findPermission(needed, options.classPermissionName, roles)) {
      return (
        <ErrorAlert
          errorType={t('Not authorized')}
          message={t('You do not have permission to open this page.')}
          description={t(
            'Ask an administrator to grant you %(permission)s on ' +
              '%(resource)s.',
            { permission: needed, resource: options.classPermissionName },
          )}
          type="warning"
          closable={false}
        />
      );
    }
  }

  // Keyed on the page id. This component stays mounted while `:pageId`
  // changes -- one route serves every page -- and the error boundary inside
  // `resolveView` holds its caught error until it is remounted. Without a
  // key that changes with the page, a move from a page that threw to any
  // other contributed page keeps showing the first page's error, and only a
  // reload clears it.
  return cloneElement(resolveView(pageId), { key: pageId });
}
