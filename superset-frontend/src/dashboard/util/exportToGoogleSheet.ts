import { SupersetClient } from '@superset-ui/core';

export async function getExportGoogleSheetsUrl(
  dashboardId: number,
): Promise<string> {
  try {
    const res = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}/export/google-sheets`,
    });

    return `https://docs.google.com/spreadsheets/d/${res.json.sheet_id}/`;
  } catch (error) {
    throw error;
  }
}
