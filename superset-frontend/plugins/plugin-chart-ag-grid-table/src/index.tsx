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
import { Behavior } from '@superset-ui/core';
import { ControlPanelSectionConfig } from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import AgGridTableChart from './AgGridTableChart';
import transformProps from './transformProps';
import controlPanel from './controlPanel';
import buildQuery from './buildQuery';
import { TableChartProps } from './types';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/Table.jpg';
import example1Dark from './images/Table-dark.jpg';
import example2 from './images/Table2.jpg';
import example2Dark from './images/Table2-dark.jpg';
import example3 from './images/Table3.jpg';
import example3Dark from './images/Table3-dark.jpg';

// must export something for the module to be exist in dev mode
export { default as __hack__ } from './types';
export * from './types';
export {
  convertAgGridStateToOwnState,
  convertSortModel,
  convertColumnState,
  convertFilterModel,
} from './stateConversion';

const AgGridTableChartPlugin = defineChart<Record<string, never>, TableChartProps>({
  metadata: {
    name: t('Table V2'),
    description: t(
      'Classic row-by-column spreadsheet like view of a dataset. Use tables to showcase a view into the underlying data or to show aggregated metrics.',
    ),
    category: t('Table'),
    behaviors: [
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
      Behavior.DrillBy,
    ],
    canBeAnnotationTypes: ['EVENT', 'INTERVAL'],
    tags: [
      t('Additive'),
      t('Business'),
      t('Pattern'),
      t('Featured'),
      t('Report'),
      t('Sequential'),
      t('Tabular'),
    ],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: example1, urlDark: example1Dark },
      { url: example2, urlDark: example2Dark },
      { url: example3, urlDark: example3Dark },
    ],
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: chartProps => transformProps(chartProps as any) as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: props => <AgGridTableChart {...(props as any)} />,
});

export { AgGridTableChartPlugin };
export default AgGridTableChartPlugin;
