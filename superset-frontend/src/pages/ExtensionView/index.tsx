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
import { useParams } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { useResolveView } from 'src/core/views';

/**
 * Generic full-page host for a single extension-registered view, reached at
 * `/extensions/view/:viewId`. Extensions cannot render their own views
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
 * loaded" placeholder from before that load finishes.
 */
const ExtensionView = () => {
  const { viewId } = useParams<{ viewId: string }>();

  const menuData: SubMenuProps = {
    name: t('Extension'),
  };

  const resolved = useResolveView(viewId ?? '');

  if (!viewId) {
    return null;
  }

  return (
    <>
      <SubMenu {...menuData} />
      {resolved}
    </>
  );
};

export default ExtensionView;
