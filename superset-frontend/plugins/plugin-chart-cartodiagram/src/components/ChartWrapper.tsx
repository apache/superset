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
import { getChartComponentRegistry } from '@superset-ui/core';
import { ThemeProvider } from '@apache-superset/core/theme';
import {
  ComponentType,
  FC,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { ChartWrapperProps } from '../types';

export const ChartWrapper: FC<ChartWrapperProps> = ({
  vizType,
  theme,
  height,
  width,
  chartConfig,
  locale,
  onRenderComplete,
  onRenderError,
}) => {
  const [Chart, setChart] = useState<ComponentType<Record<string, unknown>>>();
  const onRenderCompleteRef = useRef(onRenderComplete);
  const onRenderErrorRef = useRef(onRenderError);
  onRenderCompleteRef.current = onRenderComplete;
  onRenderErrorRef.current = onRenderError;

  useEffect(() => {
    let active = true;
    setChart(undefined);
    getChartComponentRegistry()
      .getAsPromise(vizType)
      .then(chart => {
        if (active) {
          setChart(() => chart);
        }
      })
      .catch(error => {
        if (active) {
          console.warn(`Could not load cartodiagram chart: ${error}`);
          onRenderErrorRef.current?.(error);
        }
      });
    return () => {
      active = false;
    };
  }, [vizType]);

  useLayoutEffect(() => {
    if (Chart !== undefined) {
      onRenderCompleteRef.current?.();
    }
  }, [Chart, chartConfig, height, locale, theme, width]);

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
