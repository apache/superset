import React from 'react';

import { MainComponentProps } from 'src/Superstructure/types/global';

import Routes from './Routes';

export default function Main({
  navigation,
  store,
  theme,
  basename,
}: MainComponentProps) {
  window.featureFlags = {
    ...window.featureFlags,
    DYNAMIC_PLUGINS: false,
  };

  return navigation ? (
    <>
      <Routes
        basename={basename}
        navigation={navigation}
        store={store}
        theme={theme}
      />
    </>
  ) : (
    <div>There is no navigation defined</div>
  );
}
