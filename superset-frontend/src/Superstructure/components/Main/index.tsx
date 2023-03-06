import React from 'react';

import { MainComponentProps } from 'src/Superstructure/types/global';

import Routes from './Routes';

export default function Main({
  navigation,
  store,
  basename,
}: MainComponentProps) {
  window.featureFlags = {
    ...window.featureFlags,
    DYNAMIC_PLUGINS: false,
  };

  return navigation ? (
    <>
      <Routes basename={basename} navigation={navigation} store={store} />
    </>
  ) : (
    <div>There is no navigation defined</div>
  );
}
