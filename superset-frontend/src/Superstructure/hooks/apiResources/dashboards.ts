// DODO was here
import { Dashboard, Datasource, EmbeddedDashboard } from 'src/dashboard/types';
import { Chart } from 'src/types/Chart';
import {
  useApiV1Resource,
  useTransformedResource,
} from 'src/Superstructure/hooks/apiResources/apiResources';

export const useDashboard = (idOrSlug: string | number) =>
  useTransformedResource(
    useApiV1Resource<Dashboard>(`/api/v1/dashboard/${idOrSlug}`),
    dashboard => ({
      ...dashboard,
      metadata:
        (dashboard.json_metadata && JSON.parse(dashboard.json_metadata)) || {},
      position_data:
        dashboard.position_json && JSON.parse(dashboard.position_json),
    }),
  );

// gets the chart definitions for a dashboard
export const useDashboardCharts = (idOrSlug: string | number) =>
  useApiV1Resource<Chart[]>(`/api/v1/dashboard/${idOrSlug}/charts`);

// gets the datasets for a dashboard
// important: this endpoint only returns the fields in the dataset
// that are necessary for rendering the given dashboard
export const useDashboardDatasets = (idOrSlug: string | number) =>
  useApiV1Resource<Datasource[]>(`/api/v1/dashboard/${idOrSlug}/datasets`);

export const useEmbeddedDashboard = (idOrSlug: string | number) =>
  useApiV1Resource<EmbeddedDashboard>(`/api/v1/dashboard/${idOrSlug}/embedded`);
