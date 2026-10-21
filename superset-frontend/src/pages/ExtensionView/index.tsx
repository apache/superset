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
import { Loading } from '@superset-ui/core/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ExtensionsLoader from 'src/extensions/ExtensionsLoader';
import { useRegisteredView, useResolveView } from 'src/core/views';

/**
 * Generic full-page host for a single extension-registered view, reached at
 * `/extensions/view/:viewId+`. Extensions cannot render their own views
 * directly (`resolveView`/`useResolveView` are host-internal, not part of
 * the public `@apache-superset/core` SDK) -- they register a view at
 * `GlobalLocations.settings.panel` and a matching command at
 * `GlobalLocations.settings.menu` whose callback navigates here, and the
 * host resolves and renders it.
 *
 * Uses the reactive `useResolveView`, not the plain `resolveView`: this
 * page is reachable by a direct/full navigation (a bookmark, a page
 * refresh, or an extension's own menu command falling back to
 * `window.location.assign` in the absence of an SDK-level SPA-navigation
 * primitive), and the providing extension's own code loads asynchronously
 * -- a non-reactive resolve would permanently commit to the "could not be
 * loaded" placeholder from before that load finishes. Until the extension
 * loader settles, an unregistered id shows a loading state rather than
 * that placeholder, so a slow load and a wrong id look different.
 */

/**
 * The router's `history` (v4) runs `decodeURI` on the pathname before
 * `useParams` sees it. That pass decodes everything except the URI's
 * reserved characters, so an id navigated to via `encodeURIComponent`
 * arrives with `%2F` (and friends) still escaped but every other sequence,
 * including a literal `%` sent as `%25`, already decoded. A second full
 * `decodeURIComponent` would throw on an id that legitimately contains
 * `%`, so only the reserved-character escapes that first pass leaves
 * behind are decoded here.
 */
const RESERVED_CHARACTER_ESCAPES = /%(2F|3A|40|26|3D|2B|24|2C|3B|3F|23)/gi;

const decodeViewId = (viewId: string | undefined): string =>
  (viewId ?? '').replace(RESERVED_CHARACTER_ESCAPES, escaped =>
    decodeURIComponent(escaped),
  );

/**
 * Whether `ExtensionsLoader.initializeExtensions()` has settled. The loader
 * memoizes its promise, so this awaits the same load `ExtensionsStartup`
 * kicks off; if this effect fires first, it merely starts that load early,
 * and extension code still only runs after the `/api/v1/extensions/`
 * round trip, by which point `window.superset` is in place.
 */
const useExtensionsSettled = (): boolean => {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let active = true;
    const markSettled = () => {
      if (active) {
        setSettled(true);
      }
    };
    ExtensionsLoader.getInstance()
      .initializeExtensions()
      .then(markSettled, markSettled);
    return () => {
      active = false;
    };
  }, []);
  return settled;
};

const ExtensionView = () => {
  const { viewId: rawViewId } = useParams<{ viewId: string }>();
  const viewId = decodeViewId(rawViewId);
  const registered = useRegisteredView(viewId);
  const resolved = useResolveView(viewId);
  const extensionsSettled = useExtensionsSettled();

  if (!viewId) {
    return null;
  }

  const menuData: SubMenuProps = {
    name: registered?.view.name ?? t('Extension'),
  };

  return (
    <>
      <SubMenu {...menuData} />
      {registered || extensionsSettled ? resolved : <Loading />}
    </>
  );
};

export default ExtensionView;
