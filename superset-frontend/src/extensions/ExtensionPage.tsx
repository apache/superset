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
 * @fileoverview An extension's standalone page, which the app renders in
 * place of its routes when the server answers one (`render_page` in
 * `superset_core.extensions.pages`): the component that the extension
 * registered for the page, once the extensions have loaded.
 */

import { useSyncExternalStore } from 'react';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Loading } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { usePage } from 'src/core/pages';
import ExtensionPlaceholder from './ExtensionPlaceholder';
import ExtensionsLoader from './ExtensionsLoader';

export interface ExtensionPageProps {
  /** The page's id, as its endpoint named it to `render_page`. */
  id: string;
  /** The params that its endpoint passed. */
  params: Record<string, string>;
}

const subscribe = (listener: () => void) => {
  const subscription = ExtensionsLoader.getInstance().onDidInitialize(listener);
  return () => subscription.dispose();
};

const extensionsLoaded = () => ExtensionsLoader.getInstance().isInitialized();

export default function ExtensionPage({ id, params }: ExtensionPageProps) {
  const Page = usePage(id);
  const loaded = useSyncExternalStore(subscribe, extensionsLoaded);

  if (Page) {
    return (
      <ErrorBoundary>
        <Page params={params} />
      </ErrorBoundary>
    );
  }
  // Every extension has loaded, or none will, and none registered the page.
  if (loaded || !isFeatureEnabled(FeatureFlag.EnableExtensions)) {
    return <ExtensionPlaceholder id={id} />;
  }
  return <Loading />;
}
