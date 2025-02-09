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

import { APIRequestContext, Page } from '@playwright/test';
import config from '../../playwright.config';
import { readFileSync } from 'fs';
import path from 'path';

const BASE_EXPLORE_URL = '/explore/?form_data=';
const DASHBOARD_FIXTURES: Record<string, any>[] = JSON.parse(
  readFileSync(path.join(__dirname, 'dashboards.json')).toString(),
);
const CHART_FIXTURES: Record<string, any>[] = JSON.parse(
  readFileSync(path.join(__dirname, 'charts.json')).toString(),
);

/* Dashboard helpers */
const getDashboards = async (request: APIRequestContext) => {
  const response = await request.get('/api/v1/dashboard/', {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const body = await response.body();
  const result: Record<string, any>[] = JSON.parse(body.toString()).result;
  return result;
};

const cleanDashboards = async (request: APIRequestContext) => {
  const sampleDashboards = await getDashboards(request);
  const deletableDashboards = [];
  for (const fixture of DASHBOARD_FIXTURES) {
    const isInDb = sampleDashboards
      ?.filter(
        (d: Record<string, any>) =>
          d['dashboard_title'] === fixture['dashboard_title'],
      )
      .map(i => i['id']);
    if (isInDb) {
      deletableDashboards.push(...isInDb);
    }
  }
  if (deletableDashboards.length > 0) {
    await request.delete(
      `/api/v1/dashboard/?q=!(${deletableDashboards.join(',')})`,
      {
        failOnStatusCode: false,
        headers: {
          'Content-Type': 'application/json',
          Referer: `${config.use?.baseURL}/`,
        },
      },
    );
  }
};

export const createSampleDashboards = async (
  request: APIRequestContext,
  page: Page,
  indexes?: number[],
) => {
  await cleanDashboards(request);
  for (let i = 0; i < DASHBOARD_FIXTURES.length; i++) {
    if (indexes?.includes(i) || !indexes) {
      await request.post(`/api/v1/dashboard/`, {
        failOnStatusCode: false,
        data: DASHBOARD_FIXTURES[i],
        headers: {
          'Content-Type': 'application/json',
          Referer: `${config.use?.baseURL}/`,
        },
      });
    }
  }
};

/* Chart helpers */
const getCharts = async (request: APIRequestContext) => {
  const response = await request.get('/api/v1/chart/', {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const body = await response.body();
  const result: Record<string, any>[] = JSON.parse(body.toString()).result;
  return result;
};

export const cleanCharts = async (request: APIRequestContext) => {
  const sampleCharts = await getCharts(request);
  const deletableCharts: any[] = [];
  for (const fixture of CHART_FIXTURES) {
    const isInDb = sampleCharts
      ?.filter(
        (d: Record<string, any>) => d['slice_name'] === fixture['slice_name'],
      )
      .map(i => i['id']);
    if (isInDb) {
      deletableCharts.push(...isInDb);
    }
  }
  if (deletableCharts.length > 0) {
    await request.delete(`/api/v1/chart/?q=!(${deletableCharts.join(',')})`, {
      headers: {
        'Content-Type': 'application/json',
        Referer: `${config.use?.baseURL}/`,
      },
    });
  }
};

export const createSampleCharts = async (
  request: APIRequestContext,
  page: Page,
  indexes?: number[],
) => {
  await cleanCharts(request);
  for (let i = 0; i < CHART_FIXTURES.length; i++) {
    if (indexes?.includes(i) || !indexes) {
      await request.post(`/api/v1/chart/`, {
        data: CHART_FIXTURES[i],
        headers: {
          'Content-Type': 'application/json',
          Referer: `${config.use?.baseURL}/`,
        },
      });
    }
  }
};
