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

import { pick } from 'lodash';
import { ChartProps } from '@superset-ui/core';
import { HookProps, FormDataProps } from '../components/Line/Line';

export default function transformProps(chartProps: ChartProps) {
  const { width, height, queriesData } = chartProps;
  const { data } = queriesData[0];
  const formData = chartProps.formData as FormDataProps;
  const hooks = chartProps.hooks as HookProps;

  /**
   * Use type-check to make sure the field names are expected ones
   * and only pick these fields to pass to the chart.
   */
  const fieldsFromFormData: (keyof FormDataProps)[] = [
    'encoding',
    'margin',
    'theme',
  ];

  const fieldsFromHooks: (keyof HookProps)[] = [
    'TooltipRenderer',
    'LegendRenderer',
    'LegendGroupRenderer',
    'LegendItemRenderer',
    'LegendItemMarkRenderer',
    'LegendItemLabelRenderer',
  ];

  return {
    data,
    width,
    height,
    ...pick(formData, fieldsFromFormData),
    ...pick(hooks, fieldsFromHooks),
  };
}
