/*
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

/* eslint-disable no-magic-numbers */
import { SuperChart } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import PairedTTestChartPlugin from '@superset-ui/legacy-plugin-chart-paired-t-test';
import { withResizableChartDemo } from '@storybook-shared';
import data from './data';

new PairedTTestChartPlugin().configure({ key: 'paired-t-test' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-paired-t-test',
  decorators: [withResizableChartDemo],
  args: {
    liftvaluePrecision: 4,
    pvaluePrecision: 6,
    significanceLevel: 0.05,
  },
  argTypes: {
    liftvaluePrecision: {
      control: { type: 'range', min: 1, max: 10, step: 1 },
      description: 'Decimal precision for lift values',
    },
    pvaluePrecision: {
      control: { type: 'range', min: 1, max: 10, step: 1 },
      description: 'Decimal precision for p-values',
    },
    significanceLevel: {
      control: { type: 'range', min: 0.01, max: 0.2, step: 0.01 },
      description: 'Statistical significance threshold (alpha)',
    },
  },
};

export const Basic = ({
  liftvaluePrecision,
  pvaluePrecision,
  significanceLevel,
  width,
  height,
}: {
  liftvaluePrecision: number;
  pvaluePrecision: number;
  significanceLevel: number;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType="paired-t-test"
    width={width}
    height={height}
    queriesData={[{ data }]}
    formData={{
      groupby: ['name'],
      liftvalue_precision: liftvaluePrecision,
      metrics: ['sum__num'],
      pvalue_precision: pvaluePrecision,
      significance_level: significanceLevel,
    }}
  />
);
