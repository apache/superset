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
  css,
  logging,
  styled,
  SupersetClient,
  SupersetClientResponse,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import Chart from 'src/types/Chart';
import { intersection } from 'lodash';
import rison from 'rison';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { FetchDataConfig, FilterValue } from 'src/components/ListView';
import SupersetText from 'src/utils/textUtils';
import { findPermission } from 'src/utils/findPermission';
import { User } from 'src/types/bootstrapTypes';
import { WelcomeTable } from 'src/features/home/types';
import { Dashboard, Filter, TableTab } from './types';

// Modifies the rison encoding slightly to match the backend's rison encoding/decoding. Applies globally.
// Code pulled from rison.js (https://github.com/Nanonid/rison), rison is licensed under the MIT license.
(() => {
  const risonRef: {
    not_idchar: string;
    not_idstart: string;
    id_ok: RegExp;
    next_id: RegExp;
  } = rison as any;

  const l = [];
  for (let hi = 0; hi < 16; hi += 1) {
    for (let lo = 0; lo < 16; lo += 1) {
      if (hi + lo === 0) continue;
      const c = String.fromCharCode(hi * 16 + lo);
      if (!/\w|[-_./~]/.test(c))
        l.push(`\\u00${hi.toString(16)}${lo.toString(16)}`);
    }
  }

  risonRef.not_idchar = l.join('');
  risonRef.not_idstart = '-0123456789';

  const idrx = `[^${risonRef.not_idstart}${risonRef.not_idchar}][^${risonRef.not_idchar}]*`;

  risonRef.id_ok = new RegExp(`^${idrx}$`);
  risonRef.next_id = new RegExp(idrx, 'g');
})();

export const Actions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const createFetchResourceMethod =
  (method: string) =>
  (
    resource: string,
    relation: string,
    handleError: (error: Response) => void,
    user?: { userId: string | number; firstName: string; lastName: string },
  ) =>
  async (filterValue = '', page: number, pageSize: number) => {
    const resourceEndpoint = `/api/v1/${resource}/${method}/${relation}`;
    const queryParams = rison.encode_uri({
      filter: filterValue,
      page,
      page_size: pageSize,
    });
    const { json = {} } = await SupersetClient.get({
      endpoint: `${resourceEndpoint}?q=${queryParams}`,
    });

    let fetchedLoggedUser = false;
    const loggedUser = user
      ? {
          label: `${user.firstName} ${user.lastName}`,
          value: user.userId,
        }
      : undefined;

    const data: { label: string; value: string | number }[] = [];
    json?.result
      ?.filter(({ text }: { text: string }) => text.trim().length > 0)
      .forEach(({ text, value }: { text: string; value: string | number }) => {
        if (
          loggedUser &&
          value === loggedUser.value &&
          text === loggedUser.label
        ) {
          fetchedLoggedUser = true;
        } else {
          data.push({
            label: text,
            value,
          });
        }
      });

    if (loggedUser && (!filterValue || fetchedLoggedUser)) {
      data.unshift(loggedUser);
    }

    return {
      data,
      totalCount: json?.count,
    };
  };

export const PAGE_SIZE = 5;
const getParams = (filters?: Filter[]) => {
  const params = {
    order_column: 'changed_on_delta_humanized',
    order_direction: 'desc',
    page: 0,
    page_size: PAGE_SIZE,
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
  filters: Filter[] = [
    {
      col: 'owners',
      opr: 'rel_m_m',
      value: `${userId}`,
    },
  ],
) =>
  SupersetClient.get({
    endpoint: `/api/v1/${resource}/?q=${getParams(filters)}`,
  }).then(res => res.json?.result);

export const getRecentActivityObjs = (
  userId: string | number,
  recent: string,
  addDangerToast: (arg1: string, arg2: any) => any,
  filters: Filter[],
) =>
  SupersetClient.get({ endpoint: recent }).then(recentsRes => {
    const res: any = {};
    const newBatch = [
      SupersetClient.get({
        endpoint: `/api/v1/chart/?q=${getParams(filters)}`,
      }),
      SupersetClient.get({
        endpoint: `/api/v1/dashboard/?q=${getParams(filters)}`,
      }),
    ];
    return Promise.all(newBatch)
      .then(([chartRes, dashboardRes]) => {
        res.other = [...chartRes.json.result, ...dashboardRes.json.result];
        res.viewed = recentsRes.json.result;
        return res;
      })
      .catch(errMsg =>
        addDangerToast(
          t('There was an error fetching your recent activity:'),
          errMsg,
        ),
      );
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
      errorsArray?.length &&
      config?.ERRORS &&
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
  userId?: string | number,
) {
  const filters = {
    pageIndex: 0,
    pageSize: PAGE_SIZE,
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

export function handleDashboardDelete(
  { id, dashboard_title: dashboardTitle }: Dashboard,
  refreshData: (config?: FetchDataConfig | null) => void,
  addSuccessToast: (arg0: string) => void,
  addDangerToast: (arg0: string) => void,
  dashboardFilter?: string,
  userId?: string | number,
) {
  return SupersetClient.delete({
    endpoint: `/api/v1/dashboard/${id}`,
  }).then(
    () => {
      const filters = {
        pageIndex: 0,
        pageSize: PAGE_SIZE,
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

// loading card count for homepage
export const loadingCardCount = 5;

const breakpoints = [576, 768, 992, 1200];
export const mq = breakpoints.map(bp => `@media (max-width: ${bp}px)`);

export const CardContainer = styled.div<{
  showThumbnails?: boolean | undefined;
}>`
  ${({ showThumbnails, theme }) => `
    overflow: hidden;
    display: grid;
    grid-gap: ${theme.gridUnit * 12}px ${theme.gridUnit * 4}px;
    grid-template-columns: repeat(auto-fit, 300px);
    max-height: ${showThumbnails ? '314' : '148'}px;
    margin-top: ${theme.gridUnit * -6}px;
    padding: ${
      showThumbnails
        ? `${theme.gridUnit * 8 + 3}px ${theme.gridUnit * 9}px`
        : `${theme.gridUnit * 8 + 1}px ${theme.gridUnit * 9}px`
    };
  `}
`;

export const CardStyles = styled.div`
  cursor: pointer;
  a {
    text-decoration: none;
  }
  .ant-card-cover > div {
    /* Height is calculated based on 300px width, to keep the same aspect ratio as the 800*450 thumbnails */
    height: 168px;
  }
`;

export const StyledIcon = (theme: SupersetTheme) => css`
  margin: auto ${theme.gridUnit * 2}px auto 0;
  color: ${theme.colors.grayscale.base};
`;

export /* eslint-disable no-underscore-dangle */
const isNeedsPassword = (payload: any) =>
  typeof payload === 'object' &&
  Array.isArray(payload._schema) &&
  !!payload._schema?.find(
    (e: string) => e === 'Must provide a password for the database',
  );

export /* eslint-disable no-underscore-dangle */
const isNeedsSSHPassword = (payload: any) =>
  typeof payload === 'object' &&
  Array.isArray(payload._schema) &&
  !!payload._schema?.find(
    (e: string) => e === 'Must provide a password for the ssh tunnel',
  );

export /* eslint-disable no-underscore-dangle */
const isNeedsSSHPrivateKey = (payload: any) =>
  typeof payload === 'object' &&
  Array.isArray(payload._schema) &&
  !!payload._schema?.find(
    (e: string) => e === 'Must provide a private key for the ssh tunnel',
  );

export /* eslint-disable no-underscore-dangle */
const isNeedsSSHPrivateKeyPassword = (payload: any) =>
  typeof payload === 'object' &&
  Array.isArray(payload._schema) &&
  !!payload._schema?.find(
    (e: string) =>
      e === 'Must provide a private key password for the ssh tunnel',
  );

export const isAlreadyExists = (payload: any) =>
  typeof payload === 'string' &&
  payload.includes('already exists and `overwrite=true` was not passed');

export const getPasswordsNeeded = (errors: Record<string, any>[]) =>
  errors
    .map(error =>
      Object.entries(error.extra)
        .filter(([, payload]) => isNeedsPassword(payload))
        .map(([fileName]) => fileName),
    )
    .flat();

export const getSSHPasswordsNeeded = (errors: Record<string, any>[]) =>
  errors
    .map(error =>
      Object.entries(error.extra)
        .filter(([, payload]) => isNeedsSSHPassword(payload))
        .map(([fileName]) => fileName),
    )
    .flat();

export const getSSHPrivateKeysNeeded = (errors: Record<string, any>[]) =>
  errors
    .map(error =>
      Object.entries(error.extra)
        .filter(([, payload]) => isNeedsSSHPrivateKey(payload))
        .map(([fileName]) => fileName),
    )
    .flat();

export const getSSHPrivateKeyPasswordsNeeded = (
  errors: Record<string, any>[],
) =>
  errors
    .map(error =>
      Object.entries(error.extra)
        .filter(([, payload]) => isNeedsSSHPrivateKeyPassword(payload))
        .map(([fileName]) => fileName),
    )
    .flat();

export const getAlreadyExists = (errors: Record<string, any>[]) =>
  errors
    .map(error =>
      Object.entries(error.extra)
        .filter(([, payload]) => isAlreadyExists(payload))
        .map(([fileName]) => fileName),
    )
    .flat();

export const hasTerminalValidation = (errors: Record<string, any>[]) =>
  errors.some(error => {
    const noIssuesCodes = Object.entries(error.extra).filter(
      ([key]) => key !== 'issue_codes',
    );

    if (noIssuesCodes.length === 0) return true;

    return !noIssuesCodes.every(
      ([, payload]) =>
        isNeedsPassword(payload) ||
        isAlreadyExists(payload) ||
        isNeedsSSHPassword(payload) ||
        isNeedsSSHPrivateKey(payload) ||
        isNeedsSSHPrivateKeyPassword(payload),
    );
  });

export const checkUploadExtensions = (
  perm: Array<string>,
  cons: Array<string>,
) => {
  if (perm !== undefined) {
    return intersection(perm, cons).length > 0;
  }
  return false;
};

export const uploadUserPerms = (
  roles: Record<string, [string, string][]>,
  csvExt: Array<string>,
  colExt: Array<string>,
  excelExt: Array<string>,
  allowedExt: Array<string>,
) => {
  const canUploadCSV =
    findPermission('can_this_form_get', 'CsvToDatabaseView', roles) &&
    checkUploadExtensions(csvExt, allowedExt);
  const canUploadColumnar =
    checkUploadExtensions(colExt, allowedExt) &&
    findPermission('can_this_form_get', 'ColumnarToDatabaseView', roles);
  const canUploadExcel =
    checkUploadExtensions(excelExt, allowedExt) &&
    findPermission('can_this_form_get', 'ExcelToDatabaseView', roles);
  return {
    canUploadCSV,
    canUploadColumnar,
    canUploadExcel,
    canUploadData: canUploadCSV || canUploadColumnar || canUploadExcel,
  };
};

export function getFilterValues(
  tab: TableTab,
  welcomeTable: WelcomeTable,
  user?: User,
  otherTabFilters?: Filter[],
): FilterValue[] {
  if (
    tab === TableTab.Created ||
    (welcomeTable === WelcomeTable.SavedQueries && tab === TableTab.Mine)
  ) {
    return [
      {
        id: 'created_by',
        operator: 'rel_o_m',
        value: `${user?.userId}`,
      },
    ];
  }
  if (welcomeTable === WelcomeTable.SavedQueries && tab === TableTab.Favorite) {
    return [
      {
        id: 'id',
        operator: 'saved_query_is_fav',
        value: true,
      },
    ];
  }
  if (tab === TableTab.Mine && user) {
    return [
      {
        id: 'owners',
        operator: 'rel_m_m',
        value: `${user.userId}`,
      },
    ];
  }
  if (
    tab === TableTab.Favorite &&
    [WelcomeTable.Dashboards, WelcomeTable.Charts].includes(welcomeTable)
  ) {
    return [
      {
        id: 'id',
        operator:
          welcomeTable === WelcomeTable.Dashboards
            ? 'dashboard_is_favorite'
            : 'chart_is_favorite',
        value: true,
      },
    ];
  }
  if (tab === TableTab.Other) {
    return (otherTabFilters || []).map(flt => ({
      id: flt.col,
      operator: flt.opr,
      value: flt.value,
    }));
  }
  return [];
}
