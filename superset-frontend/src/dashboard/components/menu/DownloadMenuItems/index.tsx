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
import { SyntheticEvent } from 'react';
import { logging, t } from '@apache-superset/core';
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { MenuItem } from '@superset-ui/core/components/Menu';
import contentDisposition from 'content-disposition';
import { useDownloadScreenshot } from 'src/dashboard/hooks/useDownloadScreenshot';
import { MenuKeys } from 'src/dashboard/types';
import downloadAsPdf from 'src/utils/downloadAsPdf';
import downloadAsImage from 'src/utils/downloadAsImage';
import handleResourceExport from 'src/utils/export';
import {
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE,
} from 'src/logger/LogUtils';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { ensureAppRoot } from 'src/utils/pathUtils';
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
  } = props;

  const { addDangerToast, addSuccessToast } = useToasts();
  const SCREENSHOT_NODE_SELECTOR = '.dashboard';

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

  const onExportAsExample = async () => {
    try {
      const endpoint = ensureAppRoot(
        `/api/v1/dashboard/${dashboardId}/export_as_example/`,
      );
      const response = await SupersetClient.get({
        endpoint,
        headers: {
          Accept: 'application/zip',
        },
        parseMethod: 'raw',
      });

      // Parse filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      let fileName = `dashboard_${dashboardId}_example.zip`;

      if (disposition) {
        try {
          const parsed = contentDisposition.parse(disposition);
          if (parsed?.parameters?.filename) {
            fileName = parsed.parameters.filename;
          }
        } catch (error) {
          logging.warn('Failed to parse Content-Disposition header:', error);
        }
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
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

      addSuccessToast(t('Dashboard exported as example successfully'));
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  };

  const screenshotMenuItems: MenuItem[] = isWebDriverScreenshotEnabled
    ? [
        {
          key: DownloadScreenshotFormat.PDF,
          label: pdfMenuItemTitle,
          onClick: () => downloadScreenshot(DownloadScreenshotFormat.PDF),
        },
        {
          key: DownloadScreenshotFormat.PNG,
          label: imageMenuItemTitle,
          onClick: () => downloadScreenshot(DownloadScreenshotFormat.PNG),
        },
      ]
    : [
        {
          key: 'download-pdf',
          label: pdfMenuItemTitle,
          onClick: (e: any) => onDownloadPdf(e.domEvent),
        },
        {
          key: 'download-image',
          label: imageMenuItemTitle,
          onClick: (e: any) => onDownloadImage(e.domEvent),
        },
      ];

  const exportMenuItems: MenuItem[] = [
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
