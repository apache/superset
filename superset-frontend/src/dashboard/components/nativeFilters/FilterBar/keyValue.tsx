// DODO was here
import { API_HANDLER, SupersetClient, logging } from '@superset-ui/core';
import { DashboardPermalinkValue } from 'src/dashboard/types';

const isStandalone = process.env.type === undefined; // DODO added 44611022

const assembleEndpoint = (
  dashId: string | number,
  key?: string | null,
  tabId?: string,
) => {
  // DODO changed 44611022
  let endpoint = `${
    isStandalone ? '' : '/'
  }api/v1/dashboard/${dashId}/filter_state`;
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
  // DODO changed 44611022
  (isStandalone
    ? SupersetClient.put({
        endpoint: assembleEndpoint(dashId, key, tabId),
        jsonPayload: { value },
      })
    : API_HANDLER.SupersetClient({
        method: 'put',
        url: assembleEndpoint(dashId, key, tabId),
        body: { value },
      })
  )
    .then(r => (isStandalone ? r.json.message : r))
    .catch(err => {
      logging.error(err);
      return null;
    });

export const createFilterKey = (
  dashId: string | number,
  value: string,
  tabId?: string,
) =>
  // DODO changed 44611022
  (isStandalone
    ? SupersetClient.post({
        endpoint: assembleEndpoint(dashId, undefined, tabId),
        jsonPayload: { value },
      })
    : API_HANDLER.SupersetClient({
        method: 'post',
        url: assembleEndpoint(dashId, undefined, tabId),
        jsonPayload: { value },
      })
  )
    .then(r => (isStandalone ? r.json : r).key as string)
    .catch(err => {
      logging.error(err);
      return null;
    });
export const getFilterValue = (dashId: string | number, key?: string | null) =>
  // DODO changed 44611022
  (isStandalone
    ? SupersetClient.get({
        endpoint: assembleEndpoint(dashId, key),
      })
    : API_HANDLER.SupersetClient({
        method: 'get',
        url: assembleEndpoint(dashId, key),
      })
  )
    .then(resp => JSON.parse(isStandalone ? resp.json.value : resp.value))
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
