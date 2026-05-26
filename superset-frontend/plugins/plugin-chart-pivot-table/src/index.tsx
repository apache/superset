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
import { t } from '@apache-superset/core/translation';
import { Behavior, ChartProps, QueryFormData } from '@superset-ui/core';
import { ControlPanelSectionConfig } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import buildQuery from './buildQuery';
import transformProps from './transformProps';
import controlPanel from './controlPanel';
import PivotTableChart from './PivotTableChart';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';

export * from './types';

const PivotTableChartPlugin = defineChart<
  Record<string, never>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<string, any>
>({
  metadata: {
    name: t('Pivot Table'),
    description: t(
      'Used to summarize a set of data by grouping together multiple statistics along two axes. Examples: Sales numbers by region and month, tasks by status and assignee, active users by age and location. Not the most visually stunning visualization, but highly informative and versatile.',
    ),
    category: t('Table'),
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    tags: [t('Additive'), t('Report'), t('Tabular'), t('Featured')],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },
  arguments: {},
  suppressQuerySection: true,
  prependSections: (controlPanel.controlPanelSections?.filter(
    (s): s is ControlPanelSectionConfig => s !== null && s !== undefined,
  ) ?? []) as ControlPanelSectionConfig[],
  additionalControlOverrides: controlPanel.controlOverrides as Record<
    string,
    Record<string, unknown>
  >,
  formDataOverrides: controlPanel.formDataOverrides,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (formData: any) => buildQuery(formData),
  transform: chartProps =>
    transformProps(chartProps as ChartProps<QueryFormData>),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: props => <PivotTableChart {...(props as any)} />,
});

export { PivotTableChartPlugin };
export default PivotTableChartPlugin;
