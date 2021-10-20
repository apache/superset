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
import React, { createContext, useContext, useState } from 'react';

interface EmbeddedConfigType {
  hideTitle: boolean;
  hideTab: boolean;
  hideNav: boolean;
  hideChartFilter: boolean;
}
interface EmbeddedProviderProps {
  children: JSX.Element;
  config: number;
}

export const EmbeddedContext = createContext<EmbeddedConfigType>({
  hideTitle: false,
  hideTab: false,
  hideNav: false,
  hideChartFilter: false,
});

export const useEmbedded = () => useContext(EmbeddedContext);

export const EmbeddedProvider: React.FC<EmbeddedProviderProps> = ({
  children,
  config,
}) => {
  const formattedConfig = (config >>> 0).toString(2);
  const [embeddedConfig] = useState({
    hideTitle: formattedConfig[0] === '1',
    hideTab: formattedConfig[1] === '1',
    hideNav: formattedConfig[2] === '1',
    hideChartFilter: formattedConfig[3] === '1',
  });
  return (
    <EmbeddedContext.Provider value={embeddedConfig}>
      {children}
    </EmbeddedContext.Provider>
  );
};
