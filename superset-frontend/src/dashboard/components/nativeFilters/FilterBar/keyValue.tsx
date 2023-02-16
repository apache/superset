// DODO was here TODO
import { SupersetClient, logging } from '@superset-ui/core';
import { DashboardPermalinkValue } from 'src/dashboard/types';
import { API_HANDLER } from 'src/Superstructure/api';

const assembleEndpoint = (
  dashId: string | number,
  key?: string | null,
  tabId?: string,
) => {
  let endpoint = `/api/v1/dashboard/${dashId}/filter_state`;
  // let endpoint = `/dashboard/${dashId}/filter_state`;
  if (key) {
    endpoint = endpoint.concat(`/${key}`);
  }
  if (tabId) {
    endpoint = endpoint.concat(`?tab_id=${tabId}`);
  }
  return endpoint;
};

export const updateFilterKey = (
  dashId: string,
  value: string,
  key: string,
  tabId?: string,
) =>
  SupersetClient.put({
    endpoint: assembleEndpoint(dashId, key, tabId),
    jsonPayload: { value },
  })
    .then(r => r.json.message)
    .catch(err => {
      logging.error(err);
      return null;
    });

export const createFilterKey = (
  dashId: string | number,
  value: string,
  tabId?: string,
) =>
  // SupersetClient.post({
  API_HANDLER.SupersetClient({
    method: 'post',
    url: assembleEndpoint(dashId, undefined, tabId),
    // jsonPayload: { value },
    body: { value },
  })
    // .then(r => r.json.key as string)
    .then(r => {
      return r.key
    })
    .catch(err => {
      logging.error(err);
      return null;
    });

export const getFilterValue = (dashId: string | number, key?: string | null) =>
  API_HANDLER.SupersetClient({
    method: 'get',
    url: assembleEndpoint(dashId, key)
  })
  // SupersetClient.get({
  //   endpoint: assembleEndpoint(dashId, key),
  // })
    .then(({ json }) => JSON.parse(json.value))
    .catch(err => {
      logging.error(err);
      return null;
    });

export const getPermalinkValue = (key: string) =>
  SupersetClient.get({
    endpoint: `/api/v1/dashboard/permalink/${key}`,
  })
    .then(({ json }) => json as DashboardPermalinkValue)
    .catch(err => {
      logging.error(err);
      return null;
    });
