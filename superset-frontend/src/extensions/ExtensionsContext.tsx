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
import React, {
  createContext,
  useContext,
  useState,
  ReactElement,
  useEffect,
} from 'react';
import { setExtensionsContextValue } from './ExtensionsContextUtils';

export interface ExtensionsContextType {
  views: { [id: string]: ReactElement };
  registerView: (id: string, view: ReactElement) => void;
}

const ExtensionsContext = createContext<ExtensionsContextType | undefined>(
  undefined,
);

export const ExtensionsProvider: React.FC = ({ children }) => {
  const [views, setViews] = useState<{ [id: string]: ReactElement }>({});

  const registerView = (id: string, view: ReactElement) => {
    setViews(prevViews => ({ ...prevViews, [id]: view }));
  };

  return (
    <ExtensionsContext.Provider value={{ views, registerView }}>
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
