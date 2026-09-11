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
import { useSelector } from 'react-redux';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { last } from 'lodash-es';
import rison from 'rison';
import { parse as parseContentDisposition } from 'content-disposition';
import { t } from '@apache-superset/core/translation';
import { SupersetClient, SupersetApiError } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import {
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE,
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
} from 'src/logger/LogUtils';
import { RootState } from 'src/dashboard/types';
import { getDashboardUrlParams } from 'src/utils/urlUtils';
import { DownloadScreenshotFormat } from '../components/menu/DownloadMenuItems/types';

const RETRY_INTERVAL = 3000;
// Used only until the API advertises the deployment's configured task lease.
const DEFAULT_SCREENSHOT_TASK_TIMEOUT = 6 * 60 * 1000;

type ScreenshotTaskResponse = {
  cache_key?: string;
  permalink_key?: string;
  task_status?: 'Pending' | 'Computing' | 'Updated' | 'Error';
  task_timeout_seconds?: number;
};

export const useDownloadScreenshot = (
  dashboardId: number,
  logEvent?: Function,
) => {
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs || undefined,
  );
  const anchor = useSelector(
    (state: RootState) =>
      last(state.dashboardState.directPathToChild) || undefined,
  );
  const dataMask = useSelector(
    (state: RootState) => state.dataMask || undefined,
  );

  const { addDangerToast, addSuccessToast, addInfoToast } = useToasts();

  const activeOperationCleanups = useRef(new Set<() => void>());

  const downloadScreenshot = useCallback(
    (format: DownloadScreenshotFormat) => {
      let isFetching = false;
      let isFinished = false;
      let permalinkKey: string | undefined;
      let timeoutId: NodeJS.Timeout | undefined;
      const operationStartedAt = Date.now();
      const timerIds: NodeJS.Timeout[] = [];

      const stopOperation = () => {
        isFinished = true;
        timerIds.forEach(clearInterval);
        timerIds.length = 0;
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        activeOperationCleanups.current.delete(stopOperation);
      };

      const finish = (message: 'success' | 'failure') => {
        if (isFinished) {
          return false;
        }
        stopOperation();
        if (message === 'failure') {
          addDangerToast(
            t(
              'The screenshot could not be downloaded. Please, try again later.',
            ),
          );
        } else {
          addSuccessToast(t('The screenshot has been downloaded.'));
        }
        return true;
      };

      activeOperationCleanups.current.add(stopOperation);

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
      timerIds.push(toastIntervalId);

      const fail = (logMessage: string, details: Record<string, unknown>) => {
        if (!finish('failure')) {
          return;
        }
        logging.error(logMessage, details);
      };

      // Keep one wall-clock deadline as a backstop for a hung trigger, status
      // poll, or artifact download. Once the first response arrives, align it
      // with the server's configured task lease without extending elapsed time.
      const scheduleTimeout = (timeoutMs: number) => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        const elapsed = Date.now() - operationStartedAt;
        timeoutId = setTimeout(
          () => {
            fail('Screenshot generation timed out', {
              permalinkKey,
              dashboardId,
              format,
            });
          },
          Math.max(0, timeoutMs - elapsed),
        );
      };
      scheduleTimeout(DEFAULT_SCREENSHOT_TASK_TIMEOUT);

      const downloadImage = (cacheKey: string) =>
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
            if (!finish('success')) {
              return;
            }
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          });

      const handleTaskResponse = async (json: unknown) => {
        const task = json as ScreenshotTaskResponse | undefined;
        const cacheKey = task?.cache_key;
        if (!cacheKey || !task?.permalink_key || !task.task_status) {
          throw new Error('Invalid screenshot task response');
        }
        permalinkKey = task.permalink_key;
        if (
          typeof task.task_timeout_seconds === 'number' &&
          Number.isFinite(task.task_timeout_seconds) &&
          task.task_timeout_seconds > 0
        ) {
          scheduleTimeout(task.task_timeout_seconds * 1000);
        }

        if (task.task_status === 'Error') {
          fail('Screenshot generation failed', {
            cacheKey,
            dashboardId,
            format,
          });
          return;
        }
        if (task.task_status === 'Updated') {
          await downloadImage(cacheKey);
        }
      };

      const pollTask = () => {
        if (isFinished || isFetching || !permalinkKey) {
          return;
        }
        isFetching = true;
        SupersetClient.post({
          endpoint: `/api/v1/dashboard/${dashboardId}/cache_dashboard_screenshot/`,
          jsonPayload: { permalinkKey },
        })
          .then(({ json }) => handleTaskResponse(json))
          .catch(error => {
            // A transient status/GET failure is retried. In particular, a 404
            // after `Updated` can mean the cache entry was evicted between the
            // status response and image fetch; the next POST safely recreates it.
            if ((error as SupersetApiError).status !== 404) {
              logging.error('Screenshot polling attempt failed', {
                permalinkKey,
                dashboardId,
                format,
                error,
              });
            }
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
        .then(async ({ json }) => {
          await handleTaskResponse(json);
          if (isFinished) {
            return;
          }
          const retryIntervalId = setInterval(() => {
            pollTask();
          }, RETRY_INTERVAL);
          timerIds.push(retryIntervalId);
          pollTask();
        })
        .catch(error => {
          fail('Failed to trigger dashboard screenshot', {
            dashboardId,
            format,
            error,
          });
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
      addDangerToast,
      addInfoToast,
      addSuccessToast,
      logEvent,
    ],
  );

  useEffect(() => {
    const operationCleanups = activeOperationCleanups.current;
    return () => {
      operationCleanups.forEach(cleanup => cleanup());
      operationCleanups.clear();
    };
  }, []);

  return downloadScreenshot;
};
