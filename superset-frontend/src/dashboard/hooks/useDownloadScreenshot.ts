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
import { useCallback, useEffect, useRef } from 'react';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { last } from 'lodash-es';
import { useActiveTabs, useDirectPathToChild } from 'src/dashboard/stores';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import rison from 'rison';
import { parse as parseContentDisposition } from 'content-disposition';
import { t } from '@apache-superset/core/translation';
import { SupersetClient, SupersetApiError } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import {
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE,
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
} from 'src/logger/LogUtils';
import { getDashboardUrlParams } from 'src/utils/urlUtils';
import { DownloadScreenshotFormat } from '../components/menu/DownloadMenuItems/types';

const RETRY_INTERVAL = 3000;
const DEFAULT_SCREENSHOT_TASK_TIMEOUT_SECONDS = 6 * 60;

type ScreenshotTaskResponse = {
  cache_key?: string;
  task_timeout_seconds?: number;
};

type ScreenshotTaskErrorResponse = {
  extra?: {
    task_status?: string;
  };
};

const getScreenshotTaskStatus = async (error: unknown) => {
  const apiError = error as SupersetApiError | undefined;
  if (typeof apiError?.extra?.task_status === 'string') {
    return apiError.extra.task_status;
  }
  const response = error as Response | undefined;
  if (typeof response?.clone !== 'function') {
    return undefined;
  }
  try {
    const payload = (await response
      .clone()
      .json()) as ScreenshotTaskErrorResponse;
    return payload.extra?.task_status;
  } catch {
    return undefined;
  }
};

export const useDownloadScreenshot = (
  dashboardId: number,
  logEvent?: Function,
) => {
  const activeTabsRaw = useActiveTabs();
  const activeTabs = activeTabsRaw || undefined;
  const directPathToChild = useDirectPathToChild();
  const anchor = last(directPathToChild) || undefined;
  const dataMask = useDataMaskStore(s => s.dataMask);

  const { addDangerToast, addSuccessToast, addInfoToast } = useToasts();

  const currentIntervalIds = useRef<NodeJS.Timeout[]>([]);

  const stopIntervals = useCallback(
    (message?: 'success' | 'failure') => {
      currentIntervalIds.current.forEach(clearInterval);

      if (message === 'failure') {
        addDangerToast(
          t('The screenshot could not be downloaded. Please, try again later.'),
        );
      }
      if (message === 'success') {
        addSuccessToast(t('The screenshot has been downloaded.'));
      }
    },
    [addDangerToast, addSuccessToast],
  );

  const downloadScreenshot = useCallback(
    (format: DownloadScreenshotFormat) => {
      let retries = 0;
      let maxRetries = Math.ceil(
        (DEFAULT_SCREENSHOT_TASK_TIMEOUT_SECONDS * 1000) / RETRY_INTERVAL,
      );
      let isFetching = false;
      let isDownloaded = false;
      let hasFailed = false;

      const toastIntervalId = setInterval(
        () =>
          addInfoToast(
            t(
              'The screenshot is being generated. Please, do not leave the page.',
            ),
            { noDuplicate: true },
          ),
        RETRY_INTERVAL,
      );

      currentIntervalIds.current = [
        ...(currentIntervalIds.current || []),
        toastIntervalId,
      ];

      const checkImageReady = (cacheKey: string) =>
        SupersetClient.get({
          endpoint: `/api/v1/dashboard/${dashboardId}/screenshot/${cacheKey}/?download_format=${format}`,
          headers: { Accept: 'application/pdf, image/png' },
          parseMethod: 'raw',
        })
          .then((response: Response) => {
            const disposition = response.headers.get('Content-Disposition');
            let fileName = `screenshot.${format}`; // default filename

            if (disposition) {
              try {
                const parsed = parseContentDisposition(disposition);
                if (parsed?.parameters?.filename) {
                  fileName = parsed.parameters.filename;
                }
              } catch (error) {
                console.warn(
                  'Failed to parse Content-Disposition header:',
                  error,
                );
              }
            }

            return response.blob().then(blob => ({ blob, fileName }));
          })
          .then(({ blob, fileName }) => {
            if (isDownloaded || hasFailed) {
              return;
            }
            isDownloaded = true;
            stopIntervals('success');
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          })
          .catch(async err => {
            if ((err as SupersetApiError).status === 404) {
              if ((await getScreenshotTaskStatus(err)) === 'Error') {
                hasFailed = true;
                stopIntervals('failure');
                logging.error('Screenshot generation failed', {
                  cacheKey,
                  dashboardId,
                  format,
                });
                return;
              }
              throw new Error('Image not ready');
            }
          });

      const fetchImageWithRetry = (cacheKey: string) => {
        if (isDownloaded || hasFailed || isFetching) {
          return;
        }
        if (retries >= maxRetries) {
          hasFailed = true;
          stopIntervals('failure');
          logging.error('Max retries reached', {
            cacheKey,
            dashboardId,
            format,
          });
          return;
        }
        isFetching = true;
        checkImageReady(cacheKey)
          .catch(() => {
            retries += 1;
          })
          .finally(() => {
            isFetching = false;
          });
      };

      SupersetClient.post({
        endpoint: `/api/v1/dashboard/${dashboardId}/cache_dashboard_screenshot/?q=${rison.encode({ force: true })}`,
        jsonPayload: {
          anchor,
          activeTabs,
          dataMask,
          urlParams: getDashboardUrlParams(),
        },
      })
        .then(({ json }) => {
          const task = json as ScreenshotTaskResponse | undefined;
          const cacheKey = task?.cache_key;
          if (!cacheKey) {
            throw new Error('No image URL in response');
          }
          if (
            typeof task.task_timeout_seconds === 'number' &&
            Number.isFinite(task.task_timeout_seconds) &&
            task.task_timeout_seconds > 0
          ) {
            maxRetries = Math.ceil(
              (task.task_timeout_seconds * 1000) / RETRY_INTERVAL,
            );
          }
          const retryIntervalId = setInterval(() => {
            fetchImageWithRetry(cacheKey);
          }, RETRY_INTERVAL);
          currentIntervalIds.current.push(retryIntervalId);
          fetchImageWithRetry(cacheKey);
        })
        .catch(error => {
          logging.error('Failed to trigger dashboard screenshot', {
            dashboardId,
            format,
            error,
          });
          stopIntervals('failure');
        })
        .finally(() => {
          logEvent?.(
            format === DownloadScreenshotFormat.PNG
              ? LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE
              : LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
          );
        });
    },
    [
      dashboardId,
      anchor,
      activeTabs,
      dataMask,
      addInfoToast,
      stopIntervals,
      logEvent,
    ],
  );

  useEffect(
    () => () => {
      if (currentIntervalIds.current.length > 0) {
        stopIntervals();
      }
      currentIntervalIds.current = [];
    },
    [stopIntervals],
  );

  return downloadScreenshot;
};
