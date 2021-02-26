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

import { t, SupersetClient } from '@superset-ui/core';

interface DashboardItem {
  changed_by_name: string;
  changed_on: string;
  creator: string;
  dashboard_link: string;
  dashboard_title: string;
  id: number;
  modified: string;
  url: string;
}

interface Dashboards extends DashboardItem {
  title: string;
}

export const getDashboards = async (
  query: string,
): Promise<(Dashboards | { title: string })[]> => {
  // todo: Build a dedicated endpoint for dashboard searching
  // i.e. superset/v1/api/dashboards?q=${query}
  let response;
  try {
    response = await SupersetClient.get({
      endpoint: `/dashboardasync/api/read?_oc_DashboardModelViewAsync=changed_on&_od_DashboardModelViewAsync=desc&_flt_2_dashboard_title=${query}`,
    });
  } catch (error) {
    return [{ title: t('An error occurred while fetching dashboards') }];
  }
  return response?.json.result.map((item: DashboardItem) => ({
    title: item.dashboard_title,
    ...item,
  }));
};
