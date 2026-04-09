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
// eslint-disable-next-line no-restricted-syntax
import * as supersetCore from '@apache-superset/core';
import {
  FeatureFlag,
  isFeatureEnabled,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import {
  authentication,
  core,
  commands,
  editors,
  extensions,
  menus,
  sqlLab,
  views,
} from 'src/core';
import { useSelector } from 'react-redux';
import { RootState } from 'src/views/store';
import ExtensionsLoader from './ExtensionsLoader';

declare global {
  interface Window {
    superset: {
      authentication: typeof authentication;
      core: typeof core;
      commands: typeof commands;
      editors: typeof editors;
      extensions: typeof extensions;
      menus: typeof menus;
      sqlLab: typeof sqlLab;
      views: typeof views;
      colors: typeof supersetCore.colors;
    };
  }
}

const ExtensionsStartup: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const [initialized, setInitialized] = useState(false);

  const userId = useSelector<RootState, number | undefined>(
    ({ user }) => user.userId,
  );

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
      editors,
      extensions,
      menus,
      sqlLab,
      views,
    };

    // Inject the categorical color scheme registry so extensions can access
    // Superset's registered palettes without depending on @superset-ui/core.
    supersetCore.colors.registerCategoricalSchemeRegistry(
      getCategoricalSchemeRegistry(),
    );

    const setup = async () => {
      if (isFeatureEnabled(FeatureFlag.EnableExtensions)) {
        try {
          await ExtensionsLoader.getInstance().initializeExtensions();
          supersetCore.utils.logging.info(
            'Extensions initialized successfully.',
          );
        } catch (error) {
          supersetCore.utils.logging.error(
            'Error setting up extensions:',
            error,
          );
        }
      }
      setInitialized(true);
    };

    setup();
  }, [initialized, userId]);

  if (!initialized) {
    return null;
  }

  return <>{children}</>;
};

export default ExtensionsStartup;
