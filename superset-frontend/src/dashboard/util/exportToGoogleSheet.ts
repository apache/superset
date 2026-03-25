import { SupersetClient } from '@superset-ui/core';

export async function getExportGoogleSheetsUrl(
  dashboardId: number,
): Promise<string> {
  const res = await SupersetClient.get({
    endpoint: `/api/v1/aven/${dashboardId}/export/dashboard_to_google_sheet`,
  });

  return `https://docs.google.com/spreadsheets/d/${res.json.sheet_id}/`;
}

export async function getExportSliceToGoogleSheetsUrl(
  sliceId: number,
): Promise<string> {
  const res = await SupersetClient.get({
    endpoint: `/api/v1/aven/${sliceId}/export/chart_to_google_sheet`,
  });

  return `https://docs.google.com/spreadsheets/d/${res.json.sheet_id}/`;
}
