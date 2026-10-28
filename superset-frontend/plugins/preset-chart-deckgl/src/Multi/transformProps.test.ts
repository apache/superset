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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from './transformProps';

const buildChartProps = (isRefreshing?: boolean) =>
  new ChartProps({
    width: 800,
    height: 600,
    formData: { viz_type: 'deck_multi', deck_slices: [1] },
    queriesData: [],
    theme: supersetTheme,
    isRefreshing,
  });

test('passes isRefreshing through so the chart can reload its layers', () => {
  expect(transformProps(buildChartProps(true)).isRefreshing).toBe(true);
  expect(transformProps(buildChartProps(false)).isRefreshing).toBe(false);
});

test('keeps the shared deck.gl props', () => {
  const props = transformProps(buildChartProps());
  expect(props.formData).toEqual({ viz_type: 'deck_multi', deck_slices: [1] });
  expect(props.payload).toBeUndefined();
  expect(props.viewport).toEqual({ height: 600, width: 800 });
});
