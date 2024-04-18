// DODO was here
import { SupersetClient, logging } from '@superset-ui/core';
import { DashboardPermalinkValue } from 'src/dashboard/types';
// DODO added
import { API_HANDLER } from 'src/Superstructure/api';

// DODO changed
const assembleEndpoint = (
  dashId: string | number,
  key?: string | null,
  tabId?: string,
) => {
  console.log('assembleEndpoint [ process.env.type => ', process.env.type, ']');
  if (process.env.type === undefined) {
    let endpoint = `api/v1/dashboard/${dashId}/filter_state`;
    if (key) {
      endpoint = endpoint.concat(`/${key}`);
    }
    if (tabId) {
      endpoint = endpoint.concat(`?tab_id=${tabId}`);
    }
    return endpoint;
  }
  let endpoint = `/api/v1/dashboard/${dashId}/filter_state`;
  if (key) {
    endpoint = endpoint.concat(`/${key}`);
  }
  if (tabId) {
    endpoint = endpoint.concat(`?tab_id=${tabId}`);
  }
  return endpoint;
};

// DODO changed
export const updateFilterKey = (
  dashId: string,
  value: string,
  key: string,
  tabId?: string,
) => {
  if (process.env.type === undefined) {
    return SupersetClient.put({
      endpoint: assembleEndpoint(dashId, key, tabId),
      jsonPayload: { value },
    })
      .then(r => r.json.message)
      .catch(err => {
        logging.error(err);
        return null;
      });
  }
  return API_HANDLER.SupersetClient({
    method: 'put',
    url: assembleEndpoint(dashId, key, tabId),
    body: { value },
  })
    .then(result => result)
    .catch(err => {
      logging.error(err);
      return null;
    });
};

// DODO changed
export const createFilterKey = (
  dashId: string | number,
  value: string,
  tabId?: string,
) => {
  console.log('createFilterKey [ process.env.type => ', process.env.type, ']');
  if (process.env.type === undefined) {
    return SupersetClient.post({
      endpoint: assembleEndpoint(dashId, undefined, tabId),
      jsonPayload: { value },
    })
      .then(r => r.json.key as string)
      .catch(err => {
        logging.error(err);
        return null;
      });
  }
  return API_HANDLER.SupersetClient({
    method: 'post',
    url: assembleEndpoint(dashId, undefined, tabId),
    body: { value },
  })
    .then(r => r.key)
    .catch(err => {
      logging.error(err);
      return null;
    });
};

// DODO changed
export const getFilterValue = (
  dashId: string | number,
  key?: string | null,
) => {
  console.log('getFilterValue [ process.env.type => ', process.env.type, ']');
  if (process.env.type === undefined) {
    return SupersetClient.get({
      endpoint: assembleEndpoint(dashId, key),
    })
      .then(({ json }) => JSON.parse(json.value))
      .catch(err => {
        logging.error(err);
        return null;
      });
  }
  return API_HANDLER.SupersetClient({
    method: 'get',
    url: assembleEndpoint(dashId, key),
  })
    .then(response => response.value)
    .catch(err => {
      logging.error(err);
      return null;
    });
};

export const getPermalinkValue = (key: string) =>
  SupersetClient.get({
    endpoint: `/api/v1/dashboard/permalink/${key}`,
  })
    .then(({ json }) => json as DashboardPermalinkValue)
    .catch(err => {
      logging.error(err);
      return null;
    });
