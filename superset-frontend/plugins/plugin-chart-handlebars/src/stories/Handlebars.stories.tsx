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
import { supersetTheme } from '@apache-superset/core/ui';
import { HandlebarsChartPlugin } from '@superset-ui/plugin-chart-handlebars';
import { kpiData, leaderboardData, timelineData } from './data';
import { withResizableChartDemo } from '@storybook-shared';

const VIZ_TYPE = 'handlebars';

new HandlebarsChartPlugin().configure({ key: VIZ_TYPE }).register();

getChartTransformPropsRegistry().registerValue(
  VIZ_TYPE,
  (chartProps: {
    width: number;
    height: number;
    formData: object;
    queriesData: { data: unknown[] }[];
  }) => {
    const { width, height, formData, queriesData } = chartProps;
    const { data } = queriesData[0];
    return { width, height, data, formData };
  },
);

// KPI Dashboard template - uses inline styles for Storybook compatibility
const kpiTemplate = `
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  {{#each data}}
  <div style="background: linear-gradient(135deg, {{#if (eq status 'success')}}#11998e 0%, #38ef7d{{else}}{{#if (eq status 'warning')}}#f093fb 0%, #f5576c{{else}}#667eea 0%, #764ba2{{/if}}{{/if}} 100%); border-radius: 16px; padding: 20px; color: white; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
    <div style="font-size: 32px; margin-bottom: 12px;">{{icon}}</div>
    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">{{metric}}</div>
    <div style="font-size: 32px; font-weight: 700; margin: 4px 0;">{{formatNumber value}}</div>
    <div style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; background: {{#if (gt change 0)}}rgba(255,255,255,0.2){{else}}rgba(0,0,0,0.15){{/if}};">
      {{#if (gt change 0)}}<span>▲</span>{{else}}<span>▼</span>{{/if}}
      {{change}}%
    </div>
    <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">Target: {{formatNumber target}}</div>
  </div>
  {{/each}}
</div>
`;

// Leaderboard template - dark theme with inline styles
const leaderboardTemplate = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; border-radius: 16px; padding: 24px; color: #eee;">
  <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #fff;">🏆 Top Performers</h2>
  {{#each data}}
  <div style="display: flex; align-items: center; padding: 12px 16px; margin: 8px 0; background: {{#if (eq rank 1)}}linear-gradient(90deg, rgba(255,215,0,0.2) 0%, transparent 100%){{else}}{{#if (eq rank 2)}}linear-gradient(90deg, rgba(192,192,192,0.2) 0%, transparent 100%){{else}}{{#if (eq rank 3)}}linear-gradient(90deg, rgba(205,127,50,0.2) 0%, transparent 100%){{else}}rgba(255,255,255,0.05){{/if}}{{/if}}{{/if}}; border-radius: 12px; {{#if (eq rank 1)}}border-left: 3px solid #ffd700;{{/if}}{{#if (eq rank 2)}}border-left: 3px solid #c0c0c0;{{/if}}{{#if (eq rank 3)}}border-left: 3px solid #cd7f32;{{/if}}">
    <div style="width: 28px; height: 28px; border-radius: 50%; background: {{#if (eq rank 1)}}#ffd700{{else}}{{#if (eq rank 2)}}#c0c0c0{{else}}{{#if (eq rank 3)}}#cd7f32{{else}}rgba(255,255,255,0.1){{/if}}{{/if}}{{/if}}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; margin-right: 12px; {{#if (lte rank 3)}}color: #1a1a2e;{{/if}}">{{rank}}</div>
    <div style="font-size: 28px; margin-right: 12px;">{{avatar}}</div>
    <div style="flex: 1;">
      <div style="font-weight: 600; font-size: 14px;">{{name}}</div>
      <div style="font-size: 11px; color: #888; margin-top: 2px;">{{team}}</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 18px; font-weight: 700; color: #fff;">{{formatNumber score}}</div>
      <div style="font-size: 12px; margin-top: 2px; color: {{#if (eq trend 'up')}}#38ef7d{{else}}{{#if (eq trend 'down')}}#f5576c{{else}}#888{{/if}}{{/if}};">
        {{#if (eq trend 'up')}}↑{{/if}}{{#if (eq trend 'down')}}↓{{/if}}{{#if (eq trend 'same')}}→{{/if}}
      </div>
    </div>
  </div>
  {{/each}}
</div>
`;

// Timeline template with inline styles
const timelineTemplate = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative; padding-left: 40px;">
  <div style="position: absolute; left: 13px; top: 8px; bottom: 8px; width: 3px; background: linear-gradient(180deg, #667eea 0%, #764ba2 100%); border-radius: 2px;"></div>
  {{#each data}}
  <div style="position: relative; padding: 12px 0;">
    <div style="position: absolute; left: -33px; top: 16px; width: 16px; height: 16px; border-radius: 50%; background: {{#if (eq type 'milestone')}}#ffd700{{else}}{{#if (eq type 'success')}}#38ef7d{{else}}{{#if (eq type 'warning')}}#f5576c{{else}}#667eea{{/if}}{{/if}}{{/if}}; border: 3px solid #fff; box-shadow: 0 0 0 3px {{#if (eq type 'milestone')}}rgba(255,215,0,0.3){{else}}{{#if (eq type 'success')}}rgba(56,239,125,0.3){{else}}{{#if (eq type 'warning')}}rgba(245,87,108,0.3){{else}}rgba(102,126,234,0.3){{/if}}{{/if}}{{/if}};"></div>
    <div style="background: #f8f9fa; border-radius: 12px; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-left: 8px;">
      <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">{{date}}</div>
      <div style="font-size: 16px; font-weight: 600; color: #333; margin: 4px 0;">{{event}}</div>
      <div style="font-size: 13px; color: #666; line-height: 1.4;">{{description}}</div>
    </div>
  </div>
  {{/each}}
</div>
`;

// Simple editable template for the interactive demo
const simpleTemplate = `<div style="font-family: sans-serif; padding: 16px;">
  <h2 style="margin: 0 0 16px 0;">{{title}}</h2>
  <ul style="list-style: none; padding: 0; margin: 0;">
    {{#each data}}
    <li style="padding: 8px; margin: 4px 0; background: #f5f5f5; border-radius: 4px;">
      <strong>{{metric}}</strong>: {{formatNumber value}}
    </li>
    {{/each}}
  </ul>
</div>`;

// Simple CSS for the interactive demo
const simpleCSS = `.handlebars-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.handlebars-container h2 {
  color: #333;
  margin-bottom: 16px;
}

.handlebars-container ul {
  list-style: none;
  padding: 0;
}

.handlebars-container li {
  padding: 12px;
  margin: 8px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
}`;

export default {
  title: 'Chart Plugins/plugin-chart-handlebars',
  decorators: [withResizableChartDemo],
};

export const InteractiveHandlebars = ({
  handlebarsTemplate,
  styleTemplate,
  width,
  height,
}: {
  handlebarsTemplate: string;
  styleTemplate: string;
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType={VIZ_TYPE}
    width={width}
    height={height}
    queriesData={[{ data: kpiData }]}
    formData={{
      datasource: '1__table',
      viz_type: VIZ_TYPE,
      handlebars_template: handlebarsTemplate,
      style_template: styleTemplate,
    }}
  />
);

InteractiveHandlebars.args = {
  handlebarsTemplate: simpleTemplate,
  styleTemplate: simpleCSS,
};

InteractiveHandlebars.argTypes = {
  handlebarsTemplate: {
    control: { type: 'text' },
    description: 'Handlebars template for rendering data',
  },
  styleTemplate: {
    control: { type: 'text' },
    description: 'CSS styles to apply to the chart',
  },
};

InteractiveHandlebars.parameters = {
  initialSize: {
    width: 600,
    height: 400,
  },
};

export const KPIDashboard = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType={VIZ_TYPE}
    width={width}
    height={height}
    queriesData={[{ data: kpiData }]}
    formData={{
      datasource: '1__table',
      viz_type: VIZ_TYPE,
      handlebars_template: kpiTemplate,
    }}
  />
);

KPIDashboard.parameters = {
  initialSize: {
    width: 900,
    height: 280,
  },
};

export const Leaderboard = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType={VIZ_TYPE}
    width={width}
    height={height}
    queriesData={[{ data: leaderboardData }]}
    formData={{
      datasource: '1__table',
      viz_type: VIZ_TYPE,
      handlebars_template: leaderboardTemplate,
    }}
  />
);

Leaderboard.parameters = {
  initialSize: {
    width: 450,
    height: 420,
  },
};

export const Timeline = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => (
  <SuperChart
    theme={supersetTheme}
    chartType={VIZ_TYPE}
    width={width}
    height={height}
    queriesData={[{ data: timelineData }]}
    formData={{
      datasource: '1__table',
      viz_type: VIZ_TYPE,
      handlebars_template: timelineTemplate,
    }}
  />
);

Timeline.parameters = {
  initialSize: {
    width: 500,
    height: 500,
  },
};
