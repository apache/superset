// DODO-changed
import { API_HANDLER } from 'src/Superstructure/api';

export const fetchDashboard = async (idOrSlug: string | number) =>
  API_HANDLER.SupersetClient({
    method: 'get',
    url: `/dashboard/${idOrSlug}`,
  });

export const fetchDashboardCharts = (idOrSlug: string | number) =>
  API_HANDLER.SupersetClient({
    method: 'get',
    url: `/dashboard/${idOrSlug}/charts`,
  });

export const fetchDashboardDatasets = (idOrSlug: string | number) =>
  API_HANDLER.SupersetClient({
    method: 'get',
    url: `/dashboard/${idOrSlug}/datasets`,
  });
