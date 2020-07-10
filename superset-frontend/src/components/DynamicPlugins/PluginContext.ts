import React, { useContext } from 'react';

export type PluginContextType = {
  loading: boolean;
  plugins: {
    [key: string]: {
      key: string;
      loading: boolean;
      error: null | Error;
    };
  };
  fetchAll: () => void;
  // TODO: implement this
  // fetchByKeys: (keys: string[]) => void;
};

export const dummyPluginContext: PluginContextType = {
  loading: false,
  plugins: {},
  fetchAll: () => {},
};

export const PluginContext = React.createContext(dummyPluginContext);

export const useDynamicPluginContext = () => useContext(PluginContext);
