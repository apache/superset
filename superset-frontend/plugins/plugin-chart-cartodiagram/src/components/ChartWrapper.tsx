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
import { configureStore } from '@reduxjs/toolkit';
import { getChartComponentRegistry, ThemeProvider } from '@superset-ui/core';
import { FC, useEffect, useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { ChartWrapperProps } from '../types';

export const ChartWrapper: FC<ChartWrapperProps> = ({
  vizType,
  theme,
  height,
  width,
  chartConfig,
  locale,
}) => {
  const [Chart, setChart] = useState<any>();

  const getChartFromRegistry = async (vizType: string) => {
    const registry = getChartComponentRegistry();
    const c = await registry.getAsPromise(vizType);
    setChart(() => c);
  };

  useEffect(() => {
    getChartFromRegistry(vizType);
  }, [vizType]);

  // Create a mock store that is needed by
  // eCharts components to access the locale.
  const mockStore = configureStore({
    reducer: (state = { common: { locale } }) => state,
  });

  return (
    <ThemeProvider theme={theme}>
      <ReduxProvider store={mockStore}>
        {Chart === undefined ? (
          <></>
        ) : (
          <Chart {...chartConfig.properties} height={height} width={width} />
        )}
      </ReduxProvider>
    </ThemeProvider>
  );
};

export default ChartWrapper;
