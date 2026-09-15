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
import type { ChartData } from './types';

/** A realistic multi-series time-series payload for standalone dev/demo mode. */
export const SAMPLE_CHART_DATA: ChartData = {
  chart_id: 4242,
  chart_name: 'Weekly Active Users by Platform',
  chart_type: 'echarts_timeseries_line',
  columns: [
    {
      name: 'week',
      display_name: 'Week',
      data_type: 'temporal',
      sample_values: ['2026-01-05', '2026-01-12'],
      null_count: 0,
      unique_count: 12,
    },
    {
      name: 'web',
      display_name: 'Web',
      data_type: 'numeric',
      sample_values: [18200, 19100],
      null_count: 0,
      unique_count: 12,
    },
    {
      name: 'mobile',
      display_name: 'Mobile',
      data_type: 'numeric',
      sample_values: [24300, 26800],
      null_count: 0,
      unique_count: 12,
    },
    {
      name: 'desktop_app',
      display_name: 'Desktop App',
      data_type: 'numeric',
      sample_values: [9100, 9600],
      null_count: 0,
      unique_count: 12,
    },
  ],
  data: buildRows(),
  row_count: 12,
  total_rows: 12,
  summary:
    'Weekly active users trended up 34% over the quarter, led by mobile which overtook web in week 5.',
  insights: [
    'Mobile is the fastest-growing platform (+41% QoQ).',
    'Web growth is flattening in the last three weeks.',
    'Desktop App remains a small but steady contributor.',
  ],
  recommended_visualizations: ['echarts_timeseries_line', 'echarts_area', 'echarts_timeseries_bar'],
  data_quality: { completeness: 1, sampled_rows: 12 },
  data_freshness: '2026-03-30T00:00:00Z',
};

function buildRows(): Array<Record<string, unknown>> {
  const start = new Date('2026-01-05T00:00:00Z').getTime();
  const week = 7 * 24 * 3600 * 1000;
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 12; i += 1) {
    const wave = Math.sin(i / 2.5) * 900;
    rows.push({
      week: new Date(start + i * week).toISOString().slice(0, 10),
      web: Math.round(18200 + i * 380 + wave),
      mobile: Math.round(24300 + i * 1150 + wave * 1.4),
      desktop_app: Math.round(9100 + i * 90 + wave * 0.3),
    });
  }
  return rows;
}

/** A single-value KPI payload for exercising the big-number view standalone. */
export const SAMPLE_BIG_NUMBER: ChartData = {
  chart_id: 77,
  chart_name: 'Total Revenue (QTD)',
  chart_type: 'big_number_total',
  columns: [
    {
      name: 'revenue',
      display_name: 'Total Revenue',
      data_type: 'numeric',
      sample_values: [4820000],
      null_count: 0,
      unique_count: 1,
    },
  ],
  data: [{ revenue: 4820000 }],
  row_count: 1,
  total_rows: 1,
  summary: 'Quarter-to-date revenue reached $4.82M.',
  insights: ['On track to beat the $6M quarterly target.'],
  recommended_visualizations: ['big_number_total'],
  data_quality: { completeness: 1 },
  data_freshness: '2026-03-30T00:00:00Z',
};
