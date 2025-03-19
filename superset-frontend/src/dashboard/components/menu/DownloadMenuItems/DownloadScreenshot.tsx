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

import {
  logging,
  t,
  SupersetClient,
  SupersetApiError,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import {
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE,
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
} from 'src/logger/LogUtils';
import { RootState } from 'src/dashboard/types';
import { useSelector } from 'react-redux';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { last } from 'lodash';
import { getDashboardUrlParams } from 'src/utils/urlUtils';
import { useCallback, useEffect, useRef } from 'react';
import { DownloadScreenshotFormat } from './types';

const RETRY_INTERVAL = 3000;
const MAX_RETRIES = 30;

export default function DownloadScreenshot({
  text,
  logEvent,
  dashboardId,
  format,
  ...rest
}: {
  text: string;
  dashboardId: string;
  logEvent?: Function;
  format: string;
}) {
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
  const currentIntervalIds = useRef<NodeJS.Timeout[]>([]);

  const printLoadingToast = () =>
    addInfoToast(
      t('The screenshot is being generated. Please, do not leave the page.'),
      {
        noDuplicate: true,
      },
    );

  const printFailureToast = useCallback(
    () =>
      addDangerToast(
        t('The screenshot could not be downloaded. Please, try again later.'),
      ),
    [addDangerToast],
  );

  const printSuccessToast = useCallback(
    () => addSuccessToast(t('The screenshot has been downloaded.')),
    [addSuccessToast],
  );

  const stopIntervals = useCallback(
    (message?: 'success' | 'failure') => {
      currentIntervalIds.current.forEach(clearInterval);

      if (message === 'failure') {
        printFailureToast();
      }
      if (message === 'success') {
        printSuccessToast();
      }
    },
    [printFailureToast, printSuccessToast],
  );

  const onDownloadScreenshot = () => {
    let retries = 0;

    const toastIntervalId = setInterval(
      () => printLoadingToast(),
      RETRY_INTERVAL,
    );

    currentIntervalIds.current = [
      ...(currentIntervalIds.current || []),
      toastIntervalId,
    ];

    printLoadingToast();

    // this function checks if the image is ready
    const checkImageReady = (cacheKey: string) =>
      SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboardId}/screenshot/${cacheKey}/?download_format=${format}`,
        headers: { Accept: 'application/pdf, image/png' },
        parseMethod: 'raw',
      })
        .then((response: Response) => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `screenshot.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          stopIntervals('success');
        })
        .catch(err => {
          if ((err as SupersetApiError).status === 404) {
            throw new Error('Image not ready');
          }
        });

    const fetchImageWithRetry = (cacheKey: string) => {
      if (retries >= MAX_RETRIES) {
        stopIntervals('failure');
        logging.error('Max retries reached');
        return;
      }
      checkImageReady(cacheKey).catch(() => {
        retries += 1;
      });
    };

    SupersetClient.post({
      endpoint: `/api/v1/dashboard/${dashboardId}/cache_dashboard_screenshot/`,
      jsonPayload: {
        anchor,
        activeTabs,
        dataMask,
        urlParams: getDashboardUrlParams(),
      },
    })
      .then(({ json }) => {
        const cacheKey = json?.cache_key;
        if (!cacheKey) {
          throw new Error('No image URL in response');
        }
        const retryIntervalId = setInterval(() => {
          fetchImageWithRetry(cacheKey);
        }, RETRY_INTERVAL);
        currentIntervalIds.current.push(retryIntervalId);
        fetchImageWithRetry(cacheKey);
      })
      .catch(error => {
        logging.error(error);
        stopIntervals('failure');
      })
      .finally(() => {
        logEvent?.(
          format === DownloadScreenshotFormat.PNG
            ? LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE
            : LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
        );
      });
  };

  useEffect(
    () => () => {
      if (currentIntervalIds.current.length > 0) {
        stopIntervals();
      }
      currentIntervalIds.current = [];
    },
    [stopIntervals],
  );

  return (
    <Menu.Item key={format} {...rest}>
      <div onClick={onDownloadScreenshot} role="button" tabIndex={0}>
        {text}
      </div>
    </Menu.Item>
  );
}
