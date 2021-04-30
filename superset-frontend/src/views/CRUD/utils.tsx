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

import {
  t,
  SupersetClient,
  SupersetClientResponse,
  logging,
  styled,
} from '@superset-ui/core';
import Chart from 'src/types/Chart';
import rison from 'rison';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { FetchDataConfig } from 'src/components/ListView';
import SupersetText from 'src/utils/textUtils';
import { Dashboard, Filters, SavedQueryObject } from './types';

const createFetchResourceMethod = (method: string) => (
  resource: string,
  relation: string,
  handleError: (error: Response) => void,
  userId?: string | number,
) => async (filterValue = '', pageIndex?: number, pageSize?: number) => {
  const resourceEndpoint = `/api/v1/${resource}/${method}/${relation}`;
  const options =
    userId && pageIndex === 0 ? [{ label: 'me', value: userId }] : [];
  try {
    const queryParams = rison.encode({
      ...(pageIndex ? { page: pageIndex } : {}),
      ...(pageSize ? { page_size: pageSize } : {}),
      ...(filterValue ? { filter: filterValue } : {}),
    });
    const { json = {} } = await SupersetClient.get({
      endpoint: `${resourceEndpoint}?q=${queryParams}`,
    });
    const data = json?.result?.map(
      ({ text: label, value }: { text: string; value: any }) => ({
        label,
        value,
      }),
    );

    return options.concat(data);
  } catch (e) {
    handleError(e);
  }
  return [];
};

const getParams = (filters?: Array<Filters>) => {
  const params = {
    order_column: 'changed_on_delta_humanized',
    order_direction: 'desc',
    page: 0,
    page_size: 3,
    filters,
  };
  if (!filters) delete params.filters;
  return rison.encode(params);
};

export const getEditedObjects = (userId: string | number) => {
  const filters = {
    edited: [
      {
        col: 'changed_by',
        opr: 'rel_o_m',
        value: `${userId}`,
      },
    ],
  };
  const batch = [
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${getParams(filters.edited)}`,
    }),
    SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${getParams(filters.edited)}`,
    }),
  ];
  return Promise.all(batch)
    .then(([editedCharts, editedDashboards]) => {
      const res = {
        editedDash: editedDashboards.json?.result.slice(0, 3),
        editedChart: editedCharts.json?.result.slice(0, 3),
      };
      return res;
    })
    .catch(err => err);
};

export const getUserOwnedObjects = (
  userId: string | number,
  resource: string,
) => {
  const filters = {
    created: [
      {
        col: 'created_by',
        opr: 'rel_o_m',
        value: `${userId}`,
      },
    ],
  };
  return SupersetClient.get({
    endpoint: `/api/v1/${resource}/?q=${getParams(filters.created)}`,
  }).then(res => res.json?.result);
};

export const getRecentAcitivtyObjs = (
  userId: string | number,
  recent: string,
  addDangerToast: (arg1: string, arg2: any) => any,
) =>
  SupersetClient.get({ endpoint: recent }).then(recentsRes => {
    const res: any = {};
    if (recentsRes.json.length === 0) {
      const newBatch = [
        SupersetClient.get({ endpoint: `/api/v1/chart/?q=${getParams()}` }),
        SupersetClient.get({
          endpoint: `/api/v1/dashboard/?q=${getParams()}`,
        }),
      ];
      return Promise.all(newBatch)
        .then(([chartRes, dashboardRes]) => {
          res.examples = [...chartRes.json.result, ...dashboardRes.json.result];
          return res;
        })
        .catch(errMsg =>
          addDangerToast(
            t('There was an error fetching your recent activity:'),
            errMsg,
          ),
        );
    }
    res.viewed = recentsRes.json;
    return res;
  });

export const createFetchRelated = createFetchResourceMethod('related');
export const createFetchDistinct = createFetchResourceMethod('distinct');

export function createErrorHandler(
  handleErrorFunc: (
    errMsg?: string | Record<string, string[] | string>,
  ) => void,
) {
  return async (e: SupersetClientResponse | string) => {
    const parsedError = await getClientErrorObject(e);
    // Taking the first error returned from the API
    // @ts-ignore
    const errorsArray = parsedError?.errors;
    const config = await SupersetText;
    if (
      errorsArray &&
      errorsArray.length &&
      config &&
      config.ERRORS &&
      errorsArray[0].error_type in config.ERRORS
    ) {
      parsedError.message = config.ERRORS[errorsArray[0].error_type];
    }
    logging.error(e);
    handleErrorFunc(parsedError.message || parsedError.error);
  };
}

export function handleChartDelete(
  { id, slice_name: sliceName }: Chart,
  addSuccessToast: (arg0: string) => void,
  addDangerToast: (arg0: string) => void,
  refreshData: (arg0?: FetchDataConfig | null) => void,
  chartFilter?: string,
  userId?: number,
) {
  const filters = {
    pageIndex: 0,
    pageSize: 3,
    sortBy: [
      {
        id: 'changed_on_delta_humanized',
        desc: true,
      },
    ],
    filters: [
      {
        id: 'created_by',
        operator: 'rel_o_m',
        value: `${userId}`,
      },
    ],
  };
  SupersetClient.delete({
    endpoint: `/api/v1/chart/${id}`,
  }).then(
    () => {
      if (chartFilter === 'Mine') refreshData(filters);
      else refreshData();
      addSuccessToast(t('Deleted: %s', sliceName));
    },
    () => {
      addDangerToast(t('There was an issue deleting: %s', sliceName));
    },
  );
}

export function handleBulkChartExport(chartsToExport: Chart[]) {
  return window.location.assign(
    `/api/v1/chart/export/?q=${rison.encode(
      chartsToExport.map(({ id }) => id),
    )}`,
  );
}

export function handleBulkDashboardExport(dashboardsToExport: Dashboard[]) {
  return window.location.assign(
    `/api/v1/dashboard/export/?q=${rison.encode(
      dashboardsToExport.map(({ id }) => id),
    )}`,
  );
}

export function handleBulkSavedQueryExport(
  savedQueriesToExport: SavedQueryObject[],
) {
  return window.location.assign(
    `/api/v1/saved_query/export/?q=${rison.encode(
      savedQueriesToExport.map(({ id }) => id),
    )}`,
  );
}

export function handleDashboardDelete(
  { id, dashboard_title: dashboardTitle }: Dashboard,
  refreshData: (config?: FetchDataConfig | null) => void,
  addSuccessToast: (arg0: string) => void,
  addDangerToast: (arg0: string) => void,
  dashboardFilter?: string,
  userId?: number,
) {
  return SupersetClient.delete({
    endpoint: `/api/v1/dashboard/${id}`,
  }).then(
    () => {
      const filters = {
        pageIndex: 0,
        pageSize: 3,
        sortBy: [
          {
            id: 'changed_on_delta_humanized',
            desc: true,
          },
        ],
        filters: [
          {
            id: 'owners',
            operator: 'rel_m_m',
            value: `${userId}`,
          },
        ],
      };
      if (dashboardFilter === 'Mine') refreshData(filters);
      else refreshData();
      addSuccessToast(t('Deleted: %s', dashboardTitle));
    },
    createErrorHandler(errMsg =>
      addDangerToast(
        t('There was an issue deleting %s: %s', dashboardTitle, errMsg),
      ),
    ),
  );
}

export function shortenSQL(sql: string, maxLines: number) {
  let lines: string[] = sql.split('\n');
  if (lines.length >= maxLines) {
    lines = lines.slice(0, maxLines);
    lines.push('...');
  }
  return lines.join('\n');
}

const breakpoints = [576, 768, 992, 1200];
export const mq = breakpoints.map(bp => `@media (max-width: ${bp}px)`);

export const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(31%, 31%));
  ${[mq[3]]} {
    grid-template-columns: repeat(auto-fit, minmax(31%, 31%));
  }

  ${[mq[2]]} {
    grid-template-columns: repeat(auto-fit, minmax(48%, 48%));
  }

  ${[mq[1]]} {
    grid-template-columns: repeat(auto-fit, minmax(50%, 80%));
  }
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: left;
  padding: ${({ theme }) => theme.gridUnit * 6}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
`;

export const CardStyles = styled.div`
  cursor: pointer;
  a {
    text-decoration: none;
  }
`;
