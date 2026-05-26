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
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
// eslint-disable-next-line no-restricted-syntax
import * as supersetCore from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  authentication,
  core,
  commands,
  dashboard,
  dataset,
  editors,
  explore,
  extensions,
  menus,
  navigation,
  sqlLab,
  views,
} from 'src/core';
import { notifyPageChange } from 'src/core/navigation';
import { useSelector } from 'react-redux';
import { RootState } from 'src/views/store';
import ExtensionsLoader from './ExtensionsLoader';

declare global {
  interface Window {
    superset: {
      authentication: typeof authentication;
      core: typeof core;
      commands: typeof commands;
      dashboard: typeof dashboard;
      dataset: typeof dataset;
      editors: typeof editors;
      explore: typeof explore;
      extensions: typeof extensions;
      menus: typeof menus;
      navigation: typeof navigation;
      sqlLab: typeof sqlLab;
      views: typeof views;
    };
  }
}

const ExtensionsStartup: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [initialized, setInitialized] = useState(false);
  const location = useLocation();
  const prevPathname = useRef<string | null>(null);

  const userId = useSelector<RootState, number | undefined>(
    ({ user }) => user.userId,
  );

  // Notify the navigation namespace on every route change.
  useEffect(() => {
    if (prevPathname.current !== location.pathname) {
      prevPathname.current = location.pathname;
      notifyPageChange(location.pathname);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (initialized) return;

    if (!userId) {
      // No user logged in — nothing to initialize
      setInitialized(true);
      return;
    }

    // Provide the implementations for @apache-superset/core
    window.superset = {
      ...supersetCore,
      authentication,
      core,
      commands,
      dashboard,
      dataset,
      editors,
      explore,
      extensions,
      menus,
      navigation,
      sqlLab,
      views,
    };

    // Isolate unhandled rejections that originate from extension code so they
    // cannot crash the host application. Extensions load via Module Federation
    // and their async failures (e.g. failed API calls, unhandled promise
    // chains) would otherwise surface as uncaught rejections in the host.
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Always log so extension authors can diagnose failures.
      logging.error(
        '[extensions] Unhandled rejection from extension:',
        event.reason,
      );
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Render the host immediately; extension bundles load in the background.
    // ChatbotMount re-resolves reactively once the chatbot extension registers
    // (via subscribeToLocation), so the bubble appears without blocking the UI.
    setInitialized(true);

    if (isFeatureEnabled(FeatureFlag.EnableExtensions)) {
      ExtensionsLoader.getInstance().initializeExtensions();
    }

    return () => {
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection,
      );
    };
  }, [initialized, userId]);

  if (!initialized) {
    return null;
  }

  return <>{children}</>;
};

export default ExtensionsStartup;
