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
import { getChartComponentRegistry, ThemeProvider } from '@superset-ui/core';
import { FC, useEffect, useState } from 'react';
import { ChartWrapperProps } from '../types';

export const ChartWrapper: FC<ChartWrapperProps> = ({
  vizType,
  theme,
  height,
  width,
  chartConfig,
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

  return (
    <ThemeProvider theme={theme}>
      {Chart === undefined ? (
        <></>
      ) : (
        <Chart {...chartConfig.properties} height={height} width={width} />
      )}
    </ThemeProvider>
  );
};

export default ChartWrapper;
