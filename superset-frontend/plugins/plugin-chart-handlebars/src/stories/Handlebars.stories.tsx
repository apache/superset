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

import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { HandlebarsChartPlugin } from '@superset-ui/plugin-chart-handlebars';
import { sampleData } from './data';
import { withResizableChartDemo } from '@storybook-shared';

const VIZ_TYPE = 'handlebars';

new HandlebarsChartPlugin().configure({ key: VIZ_TYPE }).register();

getChartTransformPropsRegistry().registerValue(
  VIZ_TYPE,
  (chartProps: { width: number; height: number; formData: object; queriesData: { data: unknown[] }[] }) => {
    const { width, height, formData, queriesData } = chartProps;
    const data = queriesData[0].data;
    return { width, height, data, formData };
  },
);

const tableTemplate = `<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr style="background: #f0f0f0;">
      <th style="padding: 8px; border: 1px solid #ddd;">Name</th>
      <th style="padding: 8px; border: 1px solid #ddd;">Value</th>
      <th style="padding: 8px; border: 1px solid #ddd;">Category</th>
    </tr>
  </thead>
  <tbody>
    {{#each data}}
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">{{name}}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">{{num}}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">{{category}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`;

const cardTemplate = `<div style="display: flex; flex-wrap: wrap; gap: 16px;">
  {{#each data}}
  <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; min-width: 150px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h3 style="margin: 0 0 8px 0; color: #333;">{{name}}</h3>
    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1890ff;">{{num}}</p>
    <span style="display: inline-block; margin-top: 8px; padding: 2px 8px; background: #e6f7ff; border-radius: 4px; font-size: 12px;">{{category}}</span>
  </div>
  {{/each}}
</div>`;

export default {
  title: 'Chart Plugins/plugin-chart-handlebars',
  decorators: [withResizableChartDemo],
};

export const TableView = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType={VIZ_TYPE}
    width={width}
    height={height}
    queriesData={[{ data: sampleData }]}
    formData={{
      datasource: '1__table',
      viz_type: VIZ_TYPE,
      handlebarsTemplate: tableTemplate,
    }}
  />
);

TableView.parameters = {
  initialSize: {
    width: 500,
    height: 300,
  },
};

export const CardView = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => (
  <SuperChart
    chartType={VIZ_TYPE}
    width={width}
    height={height}
    queriesData={[{ data: sampleData }]}
    formData={{
      datasource: '1__table',
      viz_type: VIZ_TYPE,
      handlebarsTemplate: cardTemplate,
    }}
  />
);

CardView.parameters = {
  initialSize: {
    width: 700,
    height: 400,
  },
};
