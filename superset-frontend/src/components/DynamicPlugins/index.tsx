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
import React, { useContext, useEffect, useReducer } from 'react';
import {
  ChartMetadata,
  defineSharedModules,
  FeatureFlag,
  getChartMetadataRegistry,
  logging,
  makeApi,
} from '@superset-ui/core';
import { isFeatureEnabled } from 'src/featureFlags';
import { omitBy } from 'lodash';

const metadataRegistry = getChartMetadataRegistry();

export type PluginContextType = {
  loading: boolean;
  /** These are actually only the dynamic plugins */
  dynamicPlugins: {
    [key: string]: {
      key: string;
      mounting: boolean;
      error: null | Error;
    };
  };
  keys: string[];
  /** Mounted means the plugin's js bundle has been imported */
  mountedPluginMetadata: Record<string, ChartMetadata>;
  fetchAll: () => void;
};

const dummyPluginContext: PluginContextType = {
  loading: true,
  dynamicPlugins: {},
  keys: [],
  mountedPluginMetadata: {},
  fetchAll: () => {},
};

/**
 * It is highly recommended to use the usePluginContext hook instead.
 * @see usePluginContext
 */
export const PluginContext = React.createContext(dummyPluginContext);

/**
 * The plugin context provides info about what dynamic plugins are available.
 * It also provides loading info for the plugins' javascript bundles.
 *
 * Note: This does not include any information about static plugins.
 * Those are compiled into the Superset bundle at build time.
 * Dynamic plugins are added by the end user and can be any webhosted javascript.
 */
export const usePluginContext = () => useContext(PluginContext);

// the plugin returned from the API
type Plugin = {
  name: string;
  key: string;
  bundle_url: string;
  id: number;
};

// when a plugin completes loading
type CompleteAction = {
  type: 'complete';
  key: string;
  error: null | Error;
};

// when plugins start loading
type BeginAction = {
  type: 'begin';
  keys: string[];
};

type ChangedKeysAction = {
  type: 'changed keys';
};

type PluginAction = BeginAction | CompleteAction | ChangedKeysAction;

function getRegistryData() {
  return {
    keys: metadataRegistry.keys(),
    mountedPluginMetadata: omitBy(
      metadataRegistry.getMap(),
      value => value === undefined,
    ) as Record<string, ChartMetadata>, // cast required to get rid of undefined values
  };
}

function pluginContextReducer(
  state: PluginContextType,
  action: PluginAction,
): PluginContextType {
  switch (action.type) {
    case 'begin': {
      const plugins = { ...state.dynamicPlugins };
      action.keys.forEach(key => {
        plugins[key] = { key, error: null, mounting: true };
      });
      return {
        ...state,
        loading: action.keys.length > 0,
        dynamicPlugins: plugins,
      };
    }
    case 'complete': {
      return {
        ...state,
        loading: Object.values(state.dynamicPlugins).some(
          plugin => plugin.mounting && plugin.key !== action.key,
        ),
        dynamicPlugins: {
          ...state.dynamicPlugins,
          [action.key]: {
            key: action.key,
            mounting: false,
            error: action.error,
          },
        },
      };
    }
    case 'changed keys': {
      return {
        ...state,
        ...getRegistryData(),
      };
    }
    default:
      return state;
  }
}

const pluginApi = makeApi<{}, { result: Plugin[] }>({
  method: 'GET',
  endpoint: '/dynamic-plugins/api/read',
});

const sharedModules = {
  react: () => import('react'),
  lodash: () => import('lodash'),
  'react-dom': () => import('react-dom'),
  '@superset-ui/chart-controls': () => import('@superset-ui/chart-controls'),
  '@superset-ui/core': () => import('@superset-ui/core'),
};

export const DynamicPluginProvider: React.FC = ({ children }) => {
  const [pluginState, dispatch] = useReducer(
    pluginContextReducer,
    dummyPluginContext,
    state => ({
      ...state,
      ...getRegistryData(),
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      fetchAll,
      loading: isFeatureEnabled(FeatureFlag.DYNAMIC_PLUGINS),
      // TODO: Write fetchByKeys
    }),
  );

  // For now, we fetch all the plugins at the same time.
  // In the future it would be nice to fetch on an as-needed basis.
  // That will most likely depend on having a json manifest for each plugin.
  async function fetchAll() {
    try {
      await defineSharedModules(sharedModules);
      const { result: plugins } = await pluginApi({});
      dispatch({ type: 'begin', keys: plugins.map(plugin => plugin.key) });
      await Promise.all(
        plugins.map(async plugin => {
          let error: Error | null = null;
          try {
            await import(/* webpackIgnore: true */ plugin.bundle_url);
          } catch (err) {
            logging.error(
              `Failed to load plugin ${plugin.key} with the following error:`,
              err.stack,
            );
            error = err;
          }
          dispatch({
            type: 'complete',
            key: plugin.key,
            error,
          });
        }),
      );
    } catch (error) {
      logging.error('Failed to load dynamic plugins', error.stack || error);
    }
  }

  useEffect(() => {
    if (isFeatureEnabled(FeatureFlag.DYNAMIC_PLUGINS)) {
      fetchAll();
    }
    const registryListener = () => {
      dispatch({ type: 'changed keys' });
    };
    metadataRegistry.addListener(registryListener);
    return () => {
      metadataRegistry.removeListener(registryListener);
    };
  }, []);

  return (
    <PluginContext.Provider value={pluginState}>
      {children}
    </PluginContext.Provider>
  );
};
