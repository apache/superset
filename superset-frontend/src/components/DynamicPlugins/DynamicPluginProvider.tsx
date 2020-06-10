import React, { useEffect, useState } from 'react';
// use scriptjs for browser-side dynamic importing
// import $script from 'scriptjs';
// import { Preset } from '@superset-ui/core';
import PluginContext, { initialPluginContext } from './PluginContext';

console.log('from superset:', React);

// In future this should be provided by an api call
const pluginUrls = ['http://localhost:8080/main.js'];

export type Props = React.PropsWithChildren<{}>;

export default function DynamicPluginProvider({ children }: Props) {
  const [pluginState] = useState(initialPluginContext);
  useEffect(() => {
    console.log('importing test');
    // $script(pluginUrls, () => {
    //   console.log('done');
    // });
    Promise.all(
      pluginUrls.map(async url => {
        const { default: d } = await import(/* webpackIgnore: true */ url);
        return d;
      }),
    ).then(pluginModules => {
      console.log(pluginModules);
      // return new Preset({
      //   name: 'Dynamic Charts',
      //   presets: [],
      //   plugins: [pluginModules],
      // });
    });
  }, [pluginUrls]);
  return (
    <PluginContext.Provider value={pluginState}>
      {children}
    </PluginContext.Provider>
  );
}
