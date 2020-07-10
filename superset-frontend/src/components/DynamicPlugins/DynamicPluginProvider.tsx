import React, { useEffect, useReducer } from 'react';
import { SupersetClient, Json } from '@superset-ui/connection';
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

// TODO: Make this function an export of @superset-ui/chart or some such
async function defineSharedModule(name: string, promise: Promise<any>) {
  // dependency management using global variables, because for the life of me
  // I can't figure out how to hook into UMD from a dynamically imported package.
  // Maybe someone else can help figure that out.
  const loadingKey = '__superset__loading__/' + name;
  const pkgKey = '__superset__/' + name;
  if (window[loadingKey]) {
    await window[loadingKey];
    return window[pkgKey];
  }
  window[loadingKey] = promise;
  const pkg = await promise;
  window[pkgKey] = pkg;
  return pkg;
}

async function defineSharedModules(moduleMap: { [key: string]: Promise<any> }) {
  return Promise.all(
    Object.entries(moduleMap).map(([name, promise]) => {
      defineSharedModule(name, promise);
      return promise;
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
      for (const key of action.keys) {
        plugins[key] = { key, error: null, loading: true };
      }
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
      await defineSharedModules({
        react: import('react'),
        lodash: import('lodash'),
        'react-dom': import('react-dom'),
        '@superset-ui/chart': import('@superset-ui/chart'),
        '@superset-ui/chart-controls': import('@superset-ui/chart-controls'),
        '@superset-ui/connection': import('@superset-ui/connection'),
        '@superset-ui/color': import('@superset-ui/color'),
        '@superset-ui/core': import('@superset-ui/core'),
        '@superset-ui/dimension': import('@superset-ui/dimension'),
        '@superset-ui/query': import('@superset-ui/query'),
        '@superset-ui/style': import('@superset-ui/style'),
        '@superset-ui/translation': import('@superset-ui/translation'),
        '@superset-ui/validator': import('@superset-ui/validator'),
      });
      const response = await SupersetClient.get({
        endpoint: '/dynamic-plugins/api/read',
      });
      const plugins: Plugin[] = (response.json as Json).result;
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
