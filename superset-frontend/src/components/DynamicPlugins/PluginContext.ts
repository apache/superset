import React from 'react';

export enum LoadingStatus {
  LOADING = 'loading',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export type PluginContextType = {
  status: LoadingStatus;
  error: null | {
    message: string;
  };
  pluginKeys: string[];
};

export const initialPluginContext: PluginContextType = {
  status: LoadingStatus.LOADING,
  error: null,
  pluginKeys: [],
};

const PluginContext = React.createContext(initialPluginContext);

export default PluginContext;
