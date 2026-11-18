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
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { EmptyState, Loading } from '@superset-ui/core/components';
import SubMenu from 'src/features/home/SubMenu';
import ExtensionsLoader from 'src/extensions/ExtensionsLoader';
import {
  canViewPage,
  ViewLocations,
  useRegisteredView,
  useResolveView,
} from 'src/core/views';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

/**
 * Host for an extension-owned page, reached at `/extensions/pages/:pageId`
 * and any sub-path below it. Only views registered at `global.page` are
 * URL-addressable; the page reads its own sub-path and query params via
 * `navigation.getLocation()`.
 *
 * The view resolves reactively: a bookmark or refresh lands here before the
 * providing extension's bundle has loaded, so an unregistered id shows a
 * loading state until the loader settles, and only then "not found".
 */

/** Whether the extension loader has settled (see `ExtensionsLoader.ready`). */
const useExtensionsReady = (): boolean => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    ExtensionsLoader.getInstance()
      .ready()
      .then(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return ready;
};

const ExtensionPage = () => {
  const { pageId = '' } = useParams<{ pageId: string }>();
  const registered = useRegisteredView(pageId);
  const page =
    registered?.location === ViewLocations.page ? registered : undefined;
  const resolved = useResolveView(pageId);
  const ready = useExtensionsReady();
  const roles = useSelector<
    { user?: UserWithPermissionsAndRoles },
    UserWithPermissionsAndRoles['roles'] | undefined
  >(state => state.user?.roles);

  if (!pageId) {
    return null;
  }

  let body;
  if (!page) {
    body = ready ? (
      <EmptyState
        title={t('Page not found')}
        description={t(
          'No extension page with id %(id)s is available. The extension may be disabled or not installed.',
          { id: pageId },
        )}
        image="empty.svg"
      />
    ) : (
      <Loading />
    );
  } else if (!canViewPage(page, roles)) {
    body = (
      <EmptyState
        title={t('Not authorized')}
        description={t("You don't have permission to view this page.")}
        image="empty.svg"
      />
    );
  } else {
    body = resolved;
  }

  return (
    <>
      <SubMenu name={page?.view.name ?? t('Extension')} />
      {body}
    </>
  );
};

export default ExtensionPage;
