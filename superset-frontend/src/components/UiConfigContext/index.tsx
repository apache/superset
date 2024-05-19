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
import { createContext, useContext, useState, FC } from 'react';

import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';

interface UiConfigType {
  hideTitle: boolean;
  hideTab: boolean;
  hideNav: boolean;
  hideChartControls: boolean;
}
interface EmbeddedUiConfigProviderProps {
  children: JSX.Element;
}

export const UiConfigContext = createContext<UiConfigType>({
  hideTitle: false,
  hideTab: false,
  hideNav: false,
  hideChartControls: false,
});

export const useUiConfig = () => useContext(UiConfigContext);

export const EmbeddedUiConfigProvider: FC<EmbeddedUiConfigProviderProps> = ({
  children,
}) => {
  const config = getUrlParam(URL_PARAMS.uiConfig) || 0;
  const [embeddedConfig] = useState({
    hideTitle: (config & 1) !== 0,
    hideTab: (config & 2) !== 0,
    hideNav: (config & 4) !== 0,
    hideChartControls: (config & 8) !== 0,
  });

  return (
    <UiConfigContext.Provider value={embeddedConfig}>
      {children}
    </UiConfigContext.Provider>
  );
};
