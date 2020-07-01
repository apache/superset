import React, { useEffect, useState } from 'react';
import {
  PluginContext,
  initialPluginContext,
  LoadingStatus,
} from './PluginContext';

// In future this should be provided by an api call
const pluginUrls = ['http://localhost:8080/main.js'];

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
    }),
  );
}

export type Props = React.PropsWithChildren<{}>;

export default function DynamicPluginProvider({ children }: Props) {
  const [pluginState, setPluginState] = useState(initialPluginContext);
  useEffect(() => {
    (async function () {
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

        await Promise.all(
          pluginUrls.map(url => import(/* webpackIgnore: true */ url)),
        );

        setPluginState({
          status: LoadingStatus.COMPLETE,
          error: null,
        });
      } catch (error) {
        console.error(error.stack || error);
        setPluginState({
          status: LoadingStatus.ERROR,
          error,
        });
      }
    })();
  }, [pluginUrls]);

  return (
    <PluginContext.Provider value={pluginState}>
      {children}
    </PluginContext.Provider>
  );
}
