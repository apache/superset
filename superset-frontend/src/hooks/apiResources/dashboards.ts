// DODO was here
import { Dashboard, Datasource, EmbeddedDashboard } from 'src/dashboard/types';
import { Chart } from 'src/types/Chart';
import { useApiV1Resource, useTransformedResource } from './apiResources';

export const useDashboard = (idOrSlug: string | number) =>
  useTransformedResource(
    useApiV1Resource<Dashboard>(`/api/v1/dashboard/${idOrSlug}`),
    dashboard => ({
      ...dashboard,
      // TODO: load these at the API level
      metadata:
        (dashboard.json_metadata && JSON.parse(dashboard.json_metadata)) || {},
      position_data:
        dashboard.position_json && JSON.parse(dashboard.position_json),
    }),
  );

// DODO changed
// check this => (export default async function callApi({) => you need to send ?language
export const useDashboardCharts = (
  idOrSlug: string | number,
  language?: string,
) =>
  useApiV1Resource<Chart[]>(
    // DODO added
    !language
      ? `/api/v1/dashboard/${idOrSlug}/charts`
      : `/api/v1/dashboard/${idOrSlug}/charts?language=${language}`,
  );

// gets the datasets for a dashboard
// important: this endpoint only returns the fields in the dataset
// that are necessary for rendering the given dashboard
// DODO changed
// check this => (export default async function callApi({) => you need to send ?language
export const useDashboardDatasets = (
  idOrSlug: string | number,
  language?: string,
) =>
  useApiV1Resource<Datasource[]>(
    // DODO added
    !language
      ? `/api/v1/dashboard/${idOrSlug}/datasets`
      : `/api/v1/dashboard/${idOrSlug}/datasets?language=${language}`,
  );

export const useEmbeddedDashboard = (idOrSlug: string | number) =>
  useApiV1Resource<EmbeddedDashboard>(`/api/v1/dashboard/${idOrSlug}/embedded`);
