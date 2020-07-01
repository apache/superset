import React, { useContext } from 'react';

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
};

export const initialPluginContext: PluginContextType = {
  status: LoadingStatus.LOADING,
  error: null,
};

export const PluginContext = React.createContext(initialPluginContext);

export const useDynamicPluginContext = () => useContext(PluginContext);
