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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
// eslint-disable-next-line no-restricted-syntax
import * as supersetCore from '@apache-superset/core';
import {
  authentication,
  chat,
  core,
  commands,
  dashboard,
  editors,
  extensions,
  menus,
  navigation,
  useNavigationTracker,
  sqlLab,
  views,
} from 'src/core';
import getCoreClientTools from 'src/core/clientTools';
import { useSelector } from 'react-redux';
import { RootState } from 'src/views/store';
import ExtensionsLoader from './ExtensionsLoader';
import 'src/extensions/Namespaces';

const ExtensionsStartup: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  useNavigationTracker();

  const userId = useSelector<RootState, number | undefined>(
    ({ user }) => user.userId,
  );
  const coreClientToolsRegistered = useRef(false);

  useEffect(() => {
    if (userId == null) return;

    // Provide the implementations for @apache-superset/core.
    // Namespaces are listed explicitly — do not spread the core package here,
    // as that would leak un-contracted symbols onto window.superset.
    window.superset = {
      ...supersetCore,
      authentication,
      chat,
      core,
      commands,
      dashboard,
      editors,
      extensions,
      menus,
      navigation,
      sqlLab,
      views,
    };

    // Guarded to run once per mount: this effect re-runs on every userId
    // change (e.g. switching accounts without a full reload), but the core
    // tool list itself never depends on which user is logged in — repeating
    // this call would just re-warn-and-overwrite every tool by name and leak
    // a fresh, uncaptured Disposable each time.
    if (!coreClientToolsRegistered.current) {
      coreClientToolsRegistered.current = true;
      // "core." is added explicitly here because this call isn't
      // extension-scoped (see ExtensionsLoader's per-extension registerClientTool(s)
      // rebind, which does this automatically for an extension's own calls).
      chat.registerClientTools(
        getCoreClientTools(chat).map(tool => ({
          ...tool,
          name: `core.${tool.name}`,
        })),
      );
    }

    if (isFeatureEnabled(FeatureFlag.EnableExtensions)) {
      ExtensionsLoader.getInstance().initializeExtensions();
    }
  }, [userId]);

  return <>{children}</>;
};

export default ExtensionsStartup;
