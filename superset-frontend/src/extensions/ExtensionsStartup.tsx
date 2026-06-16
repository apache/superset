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
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { logging } from '@apache-superset/core/utils';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  authentication,
  chat,
  core,
  commands,
  editors,
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
// Side-effect import: brings the `window.superset` global augmentation into scope.
import 'src/extensions/supersetGlobal';

const ExtensionsStartup: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
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

  // Log unhandled rejections that may originate from extension code.
  // Registered once for the lifetime of the app; does not suppress the
  // browser's default error surfacing so host error reporting is unaffected.
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logging.error('[extensions] Unhandled rejection:', event.reason);
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection,
      );
    };
  }, []);

  useEffect(() => {
    // Provide the implementations for @apache-superset/core.
    // Namespaces are listed explicitly — do not spread the core package here,
    // as that would leak un-contracted symbols onto window.superset.
    window.superset = {
      authentication,
      chat,
      core,
      commands,
      editors,
      extensions,
      menus,
      navigation,
      sqlLab,
      views,
    };

    if (isFeatureEnabled(FeatureFlag.EnableExtensions)) {
      ExtensionsLoader.getInstance().initializeExtensions();
    }
  }, [userId]);

  return <>{children}</>;
};

export default ExtensionsStartup;
