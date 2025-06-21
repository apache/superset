import { SupersetClient, t } from '@superset-ui/core';

export async function dashboardAgentQuery(query, dashboardId) {
    return SupersetClient.post({
        endpoint: `/api/v1/dashboard/query_dashboard/`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: query,
            dashboardId: dashboardId
        }),
      }).then(({ json }) => {
        const result = json.result;
        return result
        })
      .catch((error) => {
        const errorMsg = t('An error occurred while getting agent query response, Error' + error);
        return Promise.reject(new Error(errorMsg));
      });
  };
