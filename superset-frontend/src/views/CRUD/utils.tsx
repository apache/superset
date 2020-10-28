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
import getClientErrorObject from 'src/utils/getClientErrorObject';
import { Dashboard } from './types';

const createFetchResourceMethod = (method: string) => (
  resource: string,
  relation: string,
  handleError: (error: Response) => void,
) => async (filterValue = '', pageIndex?: number, pageSize?: number) => {
  const resourceEndpoint = `/api/v1/${resource}/${method}/${relation}`;

  try {
    const queryParams = rison.encode({
      ...(pageIndex ? { page: pageIndex } : {}),
      ...(pageSize ? { page_size: pageSize } : {}),
      ...(filterValue ? { filter: filterValue } : {}),
    });
    const { json = {} } = await SupersetClient.get({
      endpoint: `${resourceEndpoint}?q=${queryParams}`,
    });

    return json?.result?.map(
      ({ text: label, value }: { text: string; value: any }) => ({
        label,
        value,
      }),
    );
  } catch (e) {
    handleError(e);
  }
  return [];
};

export const getRecentAcitivtyObjs = (
  userId: string | number,
  recent: string,
  addDangerToast: (arg0: string, arg1: string) => void,
) => {
  const getParams = (filters?: Array<any>) => {
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
  const filters = {
    // chart and dashbaord uses same filters
    // for edited and created
    edited: [
      {
        col: 'changed_by',
        opr: 'rel_o_m',
        value: `${userId}`,
      },
    ],
    created: [
      {
        col: 'created_by',
        opr: 'rel_o_m',
        value: `${userId}`,
      },
    ],
  };
  const baseBatch = [
    SupersetClient.get({ endpoint: recent }),
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${getParams(filters.edited)}`,
    }),
    SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${getParams(filters.edited)}`,
    }),
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${getParams(filters.created)}`,
    }),
    SupersetClient.get({
      endpoint: `/api/v1/chart/?q=${getParams(filters.created)}`,
    }),
    SupersetClient.get({
      endpoint: `/api/v1/saved_query/?q=${getParams(filters.created)}`,
    }),
  ];
  return Promise.all(baseBatch).then(
    // @ts-ignore
    ([
      recentsRes,
      editedDash,
      editedChart,
      createdByDash,
      createdByChart,
      createdByQuery,
    ]) => {
      const res: any = {
        editedDash: editedDash.json?.result.slice(0, 3),
        editedChart: editedChart.json?.result.slice(0, 3),
        createdByDash: createdByDash.json?.result.slice(0, 3),
        createdByChart: createdByChart.json?.result.slice(0, 3),
        createdByQuery: createdByQuery.json?.result.slice(0, 3),
      };
      if (recentsRes.json.length === 0) {
        const newBatch = [
          SupersetClient.get({ endpoint: `/api/v1/chart/?q=${getParams()}` }),
          SupersetClient.get({
            endpoint: `/api/v1/dashboard/?q=${getParams()}`,
          }),
        ];
        return Promise.all(newBatch)
          .then(([chartRes, dashboardRes]) => {
            res.examples = [
              ...chartRes.json.result,
              ...dashboardRes.json.result,
            ];
            return res;
          })
          .catch(e =>
            addDangerToast(
              'There was an error fetching you recent activity:',
              e,
            ),
          );
      }
      res.viewed = recentsRes.json;
      return res;
    },
  );
};

export const createFetchRelated = createFetchResourceMethod('related');
export const createFetchDistinct = createFetchResourceMethod('distinct');

export function createErrorHandler(handleErrorFunc: (errMsg?: string) => void) {
  return async (e: SupersetClientResponse | string) => {
    const parsedError = await getClientErrorObject(e);
    logging.error(e);
    handleErrorFunc(parsedError.message || parsedError.error);
  };
}

export function handleChartDelete(
  { id, slice_name: sliceName }: Chart,
  addSuccessToast: (arg0: string) => void,
  addDangerToast: (arg0: string) => void,
  refreshData: () => void,
) {
  SupersetClient.delete({
    endpoint: `/api/v1/chart/${id}`,
  }).then(
    () => {
      refreshData();
      addSuccessToast(t('Deleted: %s', sliceName));
    },
    () => {
      addDangerToast(t('There was an issue deleting: %s', sliceName));
    },
  );
}

export function handleBulkDashboardExport(dashboardsToExport: Dashboard[]) {
  return window.location.assign(
    `/api/v1/dashboard/export/?q=${rison.encode(
      dashboardsToExport.map(({ id }) => id),
    )}`,
  );
}

export function handleDashboardDelete(
  { id, dashboard_title: dashboardTitle }: Dashboard,
  refreshData: () => void,
  addSuccessToast: (arg0: string) => void,
  addDangerToast: (arg0: string) => void,
) {
  return SupersetClient.delete({
    endpoint: `/api/v1/dashboard/${id}`,
  }).then(
    () => {
      refreshData();
      addSuccessToast(t('Deleted: %s', dashboardTitle));
    },
    createErrorHandler(errMsg =>
      addDangerToast(
        t('There was an issue deleting %s: %s', dashboardTitle, errMsg),
      ),
    ),
  );
}

export function createChartDeleteFunction(
  { id, slice_name: sliceName }: Chart,
  addSuccessToast: (arg0: string) => void,
  addDangerToast: (arg0: string) => void,
  refreshData: () => void,
) {
  SupersetClient.delete({
    endpoint: `/api/v1/chart/${id}`,
  }).then(
    () => {
      refreshData();
      addSuccessToast(t('Deleted: %s', sliceName));
    },
    () => {
      addDangerToast(t('There was an issue deleting: %s', sliceName));
    },
  );
}

const breakpoints = [576, 768, 992, 1200];
export const mq = breakpoints.map(bp => `@media (max-width: ${bp}px)`);

export const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(31%, max-content));
  ${[mq[3]]} {
    grid-template-columns: repeat(auto-fit, minmax(31%, max-content));
  }

  ${[mq[2]]} {
    grid-template-columns: repeat(auto-fit, minmax(48%, max-content));
  }

  ${[mq[1]]} {
    grid-template-columns: repeat(auto-fit, minmax(50%, max-content));
  }
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: left;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 6}px;
`;

export const IconContainer = styled.div`
  svg {
    vertical-align: -7px;
    color: ${({ theme }) => theme.colors.primary.dark1};
  }
`;
