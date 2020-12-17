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
import React, { useEffect, useReducer } from 'react';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import {
  PluginContext,
  PluginContextType,
  dummyPluginContext,
} from './PluginContext';

// the plugin returned from the API
type Plugin = {
  name: string;
  key: string;
  bundle_url: string;
  id: number;
};

type Module = any;

/**
 * This is where packages are stored. We use window, because it plays well with Webpack.
 * To avoid
 * Have to amend the type of window, because window's usual type doesn't describe these fields.
 */
interface ModuleReferencer {
  [packageKey: string]: Promise<Module>;
}

declare const window: Window & typeof globalThis & ModuleReferencer;

const modulePromises: { [key: string]: Promise<Module> } = {};

/**
 * Dependency management using global variables, because for the life of me
 * I can't figure out how to hook into UMD from a dynamically imported package.
 *
 * This defines a dynamically imported js module that can be used to import from
 * multiple different plugins.
 *
 * When importing a common module (such as react or lodash or superset-ui)
 * from a plugin, the plugin's build config will be able to
 * reference these globals instead of rebuilding them.
 *
 * @param name the module's name (should match name in package.json)
 * @param promise the promise resulting from a call to `import(name)`
 */
export async function defineSharedModule(
  name: string,
  fetchModule: () => Promise<Module>,
) {
  // this field on window is used by dynamic plugins to reference the module
  const moduleKey = `__superset__/${name}`;

  if (!window[moduleKey] && !modulePromises[name]) {
    // if the module has not been loaded, load it
    const modulePromise = fetchModule();
    modulePromises[name] = modulePromise;
    // wait for the module to load, and attach the result to window
    window[moduleKey] = await modulePromise;
  }

  // we always return a reference to the promise.
  // Multiple consumers can `.then()` or `await` the same promise,
  // even long after it has completed,
  // and it will always call back with the same reference.
  return modulePromises[name];
}

/**
 * Define multiple shared modules at once, using a map of name -> `import(name)`
 *
 * @see defineSharedModule
 * @param moduleMap
 */
export async function defineSharedModules(moduleMap: {
  [key: string]: () => Promise<Module>;
}) {
  return Promise.all(
    Object.entries(moduleMap).map(([name, fetchModule]) => {
      return defineSharedModule(name, fetchModule);
    }),
  );
}

type CompleteAction = {
  type: 'complete';
  key: string;
  error: null | Error;
};

type BeginAction = {
  type: 'begin';
  keys: string[];
};

function pluginContextReducer(
  state: PluginContextType,
  action: BeginAction | CompleteAction,
): PluginContextType {
  switch (action.type) {
    case 'begin': {
      const plugins = { ...state.plugins };
      action.keys.forEach(key => {
        plugins[key] = { key, error: null, loading: true };
      });
      return {
        ...state,
        loading: true,
        plugins,
      };
    }
    case 'complete': {
      return {
        ...state,
        loading: Object.values(state.plugins).some(
          plugin => plugin.loading && plugin.key !== action.key,
        ),
        plugins: {
          ...state.plugins,
          [action.key]: {
            key: action.key,
            loading: false,
            error: action.error,
          },
        },
      };
    }
    default:
      return state;
  }
}

export type Props = React.PropsWithChildren<{}>;

const sharedModules = {
  react: () => import('react'),
  lodash: () => import('lodash'),
  'react-dom': () => import('react-dom'),
  '@superset-ui/chart-controls': () => import('@superset-ui/chart-controls'),
  '@superset-ui/core': () => import('@superset-ui/core'),
};

export default function DynamicPluginProvider({ children }: Props) {
  const [pluginState, dispatch] = useReducer(pluginContextReducer, {
    // use the dummy plugin context, and override the methods
    ...dummyPluginContext,
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    fetchAll,
    loading: isFeatureEnabled(FeatureFlag.DYNAMIC_PLUGINS),
    // TODO: Write fetchByKeys
  });

  async function fetchAll() {
    try {
      await defineSharedModules(sharedModules);
      // const response = await SupersetClient.get({
      //   endpoint: '/dynamic-plugins/api/read',
      // });
      // const plugins: Plugin[] = (response.json as JsonObject).result;
      const plugins: Plugin[] = [
        {
          name: 'Hello World',
          key: 'superset-chart-hello-world',
          id: 0,
          bundle_url: 'http://127.0.0.1:8080/main.js',
        },
      ];
      dispatch({ type: 'begin', keys: plugins.map(plugin => plugin.key) });
      await Promise.all(
        plugins.map(async plugin => {
          let error: Error | null = null;
          try {
            await import(/* webpackIgnore: true */ plugin.bundle_url);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
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
      // eslint-disable-next-line no-console
      console.error(error.stack || error);
    }
  }

  useEffect(() => {
    if (isFeatureEnabled(FeatureFlag.DYNAMIC_PLUGINS)) {
      fetchAll();
    }
  }, []);

  return (
    <PluginContext.Provider value={pluginState}>
      {children}
    </PluginContext.Provider>
  );
}
