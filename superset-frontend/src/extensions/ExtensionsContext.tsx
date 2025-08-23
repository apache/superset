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
import {
  createContext,
  useContext,
  useState,
  ReactElement,
  useEffect,
  useMemo,
} from 'react';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { setExtensionsContextValue } from './ExtensionsContextUtils';
import ExtensionPlaceholder from './ExtensionPlaceholder';

export interface ExtensionsContextType {
  getView: (id: string) => ReactElement;
  registerViewProvider: (id: string, viewProvider: () => ReactElement) => void;
  unregisterViewProvider: (id: string) => void;
}

const ExtensionsContext = createContext<ExtensionsContextType | undefined>(
  undefined,
);

export const ExtensionsProvider: React.FC = ({ children }) => {
  const [viewProviders, setViewProviders] = useState<{
    [id: string]: () => ReactElement;
  }>({});

  const registerViewProvider = (
    id: string,
    viewProvider: () => ReactElement,
  ) => {
    setViewProviders(prev => ({ ...prev, [id]: viewProvider }));
  };

  const unregisterViewProvider = (id: string) => {
    setViewProviders(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const getView = (id: string) => {
    const viewProvider = viewProviders[id];
    if (viewProvider) {
      return <ErrorBoundary>{viewProvider()}</ErrorBoundary>;
    }
    return <ExtensionPlaceholder id={id} />;
  };

  const contextValue = useMemo(
    () => ({ getView, registerViewProvider, unregisterViewProvider }),
    [viewProviders],
  );

  return (
    <ExtensionsContext.Provider value={contextValue}>
      {children}
    </ExtensionsContext.Provider>
  );
};

export const useExtensionsContext = () => {
  const context = useContext(ExtensionsContext);
  if (!context) {
    throw new Error(
      'useExtensionsContext must be used within a ExtensionsProvider',
    );
  }

  useEffect(() => {
    setExtensionsContextValue(context);
  }, [context]);

  return context;
};
