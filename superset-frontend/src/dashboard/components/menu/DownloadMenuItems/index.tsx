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
import { SyntheticEvent, useState } from 'react';
import { useSelector } from 'react-redux';
import { logging } from '@apache-superset/core/utils';
import { t } from '@apache-superset/core/translation';
import {
  FeatureFlag,
  getClientErrorObject,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { parse as parseContentDisposition } from 'content-disposition';
import { useDownloadScreenshot } from 'src/dashboard/hooks/useDownloadScreenshot';
import { NATIVE_FILTER_PREFIX } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/utils';
import { MenuKeys, RootState } from 'src/dashboard/types';
import downloadAsPdf from 'src/utils/downloadAsPdf';
import downloadAsImage from 'src/utils/downloadAsImage';
import handleResourceExport from 'src/utils/export';
import {
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE,
} from 'src/logger/LogUtils';
import { useToasts } from 'src/components/MessageToasts/withToasts';

import { MenuItemTooltip } from 'src/components/Chart/DisabledMenuItemTooltip';
import { DownloadScreenshotFormat } from './types';

export interface UseDownloadMenuItemsProps {
  pdfMenuItemTitle: string;
  imageMenuItemTitle: string;
  dashboardTitle: string;
  logEvent?: Function;
  dashboardId: number;
  title: string;
  disabled?: boolean;
  userCanExport?: boolean;
  canExportImage?: boolean;
}

export const useDownloadMenuItems = (
  props: UseDownloadMenuItemsProps,
): MenuItem => {
  const {
    pdfMenuItemTitle,
    imageMenuItemTitle,
    logEvent,
    dashboardId,
    dashboardTitle,
    disabled,
    title,
    userCanExport,
    canExportImage,
  } = props;

  const { addDangerToast, addSuccessToast } = useToasts();
  const dataMask = useSelector((state: RootState) => state.dataMask);
  // The mode whose export is in flight, if any. The server allows one export
  // per user and dashboard at a time, so while one runs both actions are
  // disabled and the one that was clicked reports its progress.
  const [exportingXlsx, setExportingXlsx] = useState<'data' | 'images' | null>(
    null,
  );
  const SCREENSHOT_NODE_SELECTOR = '.dashboard';

  const buildActiveDataMask = (): Record<string, { extraFormData: object }> =>
    Object.entries(dataMask || {}).reduce<
      Record<string, { extraFormData: object }>
    >((acc, [id, mask]) => {
      if (id.startsWith(NATIVE_FILTER_PREFIX)) {
        acc[id] = { extraFormData: mask?.extraFormData ?? {} };
      }
      return acc;
    }, {});

  const isWebDriverScreenshotEnabled =
    isFeatureEnabled(FeatureFlag.EnableDashboardScreenshotEndpoints) &&
    isFeatureEnabled(FeatureFlag.EnableDashboardDownloadWebDriverScreenshot);

  const downloadScreenshot = useDownloadScreenshot(dashboardId, logEvent);

  const onDownloadPdf = async (e: SyntheticEvent) => {
    try {
      downloadAsPdf(SCREENSHOT_NODE_SELECTOR, dashboardTitle, true)(e);
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
    logEvent?.(LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF);
  };

  const onDownloadImage = async (e: SyntheticEvent) => {
    try {
      downloadAsImage(SCREENSHOT_NODE_SELECTOR, dashboardTitle, true)(e);
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
    logEvent?.(LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE);
  };

  const onExportZip = async () => {
    try {
      await handleResourceExport('dashboard', [dashboardId], () => {});
      addSuccessToast(t('Dashboard exported successfully'));
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  };

  const fileNameFromResponse = (
    response: Response,
    fallback: string,
  ): string => {
    const disposition = response.headers.get('Content-Disposition');
    if (!disposition) {
      return fallback;
    }
    try {
      return (
        parseContentDisposition(disposition)?.parameters?.filename ?? fallback
      );
    } catch (error) {
      logging.warn('Failed to parse Content-Disposition header:', error);
      return fallback;
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      window.URL.revokeObjectURL(url);
    }
  };

  const onExportAsExample = async () => {
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboardId}/export_as_example/`,
        headers: {
          Accept: 'application/zip',
        },
        parseMethod: 'raw',
      });

      const blob = await response.blob();
      downloadBlob(
        blob,
        fileNameFromResponse(response, `dashboard_${dashboardId}_example.zip`),
      );

      addSuccessToast(t('Dashboard exported as example successfully'));
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  };

  const onExportXlsx = async (mode: 'data' | 'images') => {
    setExportingXlsx(mode);
    try {
      const response = await SupersetClient.post({
        endpoint: `/api/v1/dashboard/${dashboardId}/export_xlsx/`,
        jsonPayload: { active_data_mask: buildActiveDataMask(), mode },
        // The response is either JSON describing a queued export or the workbook
        // itself, so it is parsed here rather than by the client.
        parseMethod: 'raw',
      });

      // Where the deployment has export storage the work is queued and delivered
      // by email (202). Where it has none the server builds the workbook during
      // the request and returns the file, which the browser downloads directly.
      if (response.status !== 202) {
        const blob = await response.blob();
        downloadBlob(
          blob,
          fileNameFromResponse(response, `dashboard_${dashboardId}.xlsx`),
        );
        addSuccessToast(t('Dashboard data exported to Excel'));
        return;
      }

      // The throttle response (an export is already running) returns 202 with a
      // message but no job_id; only a freshly enqueued job carries a job_id.
      const json = (await response.json()) as { job_id?: string };
      if (json?.job_id) {
        addSuccessToast(
          t(
            "Your export is being prepared. You'll receive an email when it's ready.",
          ),
        );
      } else {
        addSuccessToast(
          t('An export for this dashboard is already in progress.'),
        );
      }
    } catch (error) {
      // status/message come from the response (Partial<SupersetClientResponse>),
      // which the union type does not expose uniformly; read them via a narrow
      // cast.
      const { status, message } = (await getClientErrorObject(error)) as {
        status?: number;
        message?: string;
      };
      // A refusal explains itself — the export is too large to build in one
      // request, and says what to configure — so pass it on rather than
      // replacing it with a generic failure. Server-side faults stay generic.
      if (message && status && status >= 400 && status < 500) {
        addDangerToast(message);
      } else {
        addDangerToast(t('Sorry, something went wrong. Try again later.'));
      }
    } finally {
      // However the request ends, the action has to come back: otherwise a
      // failure would leave it stuck until the dashboard is reloaded.
      setExportingXlsx(null);
    }
  };

  const imageDisabled = canExportImage === false;

  const imageExportLabel = (text: string) =>
    imageDisabled ? (
      <span>
        {text}
        <MenuItemTooltip
          title={t("You don't have permission to export images")}
        />
      </span>
    ) : (
      text
    );

  const screenshotMenuItems: MenuItem[] = isWebDriverScreenshotEnabled
    ? [
        {
          key: DownloadScreenshotFormat.PDF,
          label: imageExportLabel(pdfMenuItemTitle),
          disabled: imageDisabled,
          onClick: () => downloadScreenshot(DownloadScreenshotFormat.PDF),
        },
        {
          key: DownloadScreenshotFormat.PNG,
          label: imageExportLabel(imageMenuItemTitle),
          disabled: imageDisabled,
          onClick: () => downloadScreenshot(DownloadScreenshotFormat.PNG),
        },
      ]
    : [
        {
          key: 'download-pdf',
          label: imageExportLabel(pdfMenuItemTitle),
          disabled: imageDisabled,
          onClick: (e: any) => onDownloadPdf(e.domEvent),
        },
        {
          key: 'download-image',
          label: imageExportLabel(imageMenuItemTitle),
          disabled: imageDisabled,
          onClick: (e: any) => onDownloadImage(e.domEvent),
        },
      ];

  const xlsxExportLabel = (mode: 'data' | 'images', text: string) =>
    exportingXlsx === mode ? t('Preparing export…') : text;

  const exportMenuItems: MenuItem[] = [
    ...(userCanExport
      ? [
          {
            key: 'export-xlsx',
            label: xlsxExportLabel('data', t('Export Data to Excel')),
            disabled: exportingXlsx !== null,
            onClick: () => onExportXlsx('data'),
          },
          // Image export renders charts through the headless webdriver, so only
          // offer it where that infrastructure is available (same signal as the
          // PDF/PNG image downloads above); otherwise non-table charts would
          // silently come back empty.
          ...(isWebDriverScreenshotEnabled
            ? [
                {
                  key: 'export-xlsx-images',
                  label: xlsxExportLabel('images', t('Export Images to Excel')),
                  disabled: exportingXlsx !== null,
                  onClick: () => onExportXlsx('images'),
                },
              ]
            : []),
        ]
      : []),
    {
      key: 'export-yaml',
      label: t('Export YAML'),
      onClick: onExportZip,
    },
    ...(userCanExport
      ? [
          {
            key: 'export-as-example',
            label: t('Export as Example'),
            onClick: onExportAsExample,
          },
        ]
      : []),
  ];

  const children: MenuItem[] = [
    ...screenshotMenuItems,
    { type: 'divider', key: 'export-divider' },
    ...exportMenuItems,
  ];

  return {
    key: MenuKeys.Download,
    type: 'submenu',
    label: title,
    disabled,
    children,
  };
};
