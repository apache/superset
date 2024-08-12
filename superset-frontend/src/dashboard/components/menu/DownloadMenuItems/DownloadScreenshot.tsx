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

import { logging, t, SupersetClient } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import {
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE,
  LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
} from 'src/logger/LogUtils';
import { RootState } from 'src/dashboard/types';
import { useSelector } from 'react-redux';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { last } from 'lodash';
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
  const anchor = useSelector(
    (state: RootState) => last(state.dashboardState.activeTabs) || undefined,
  );
  const { addDangerToast, addSuccessToast, addInfoToast } = useToasts();

  const onDownloadScreenshot = () => {
    let retries = 0;

    // this function checks if the image is ready
    const checkImageReady = (imageUrl: string) =>
      fetch(`${imageUrl}?download_format=${format}`)
        .then(response => {
          if (response.status === 404) {
            throw new Error('Image not ready');
          }
          return response.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `screenshot.${format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        });

    // this is the functions that handles the retries
    const fetchImageWithRetry = (imageUrl: string) => {
      checkImageReady(imageUrl)
        .then(() => {
          addSuccessToast(t('The screenshot is now being downloaded.'));
        })
        .catch(error => {
          // we check how many retries have been made
          if (retries < MAX_RETRIES) {
            retries += 1;
            addInfoToast(
              t(
                'The screenshot is being generated. Please, do not leave the page.',
              ),
              {
                noDuplicate: true,
              },
            );
            setTimeout(() => fetchImageWithRetry(imageUrl), RETRY_INTERVAL);
          } else {
            addDangerToast(
              t(
                'The screenshot could not be downloaded. Please, try again later.',
              ),
            );
            logging.error(error);
          }
        });
    };

    SupersetClient.post({
      endpoint: `/api/v1/dashboard/${dashboardId}/cache_dashboard_screenshot`,
      jsonPayload: {
        anchor,
      },
    })
      .then(({ json }) => {
        const imageUrl = json?.image_url;
        if (!imageUrl) {
          throw new Error('No image URL in response');
        }
        addInfoToast(
          t(
            'The screenshot is being generated. Please, do not leave the page.',
          ),
        );
        fetchImageWithRetry(imageUrl);
      })
      .catch(error => {
        logging.error(error);
        addDangerToast(
          t('The screenshot could not be downloaded. Please, try again later.'),
        );
      })
      .finally(() => {
        logEvent?.(
          format === DownloadScreenshotFormat.PNG
            ? LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_IMAGE
            : LOG_ACTIONS_DASHBOARD_DOWNLOAD_AS_PDF,
        );
      });
  };

  return (
    <Menu.Item key={format} {...rest}>
      <div onClick={onDownloadScreenshot} role="button" tabIndex={0}>
        {text}
      </div>
    </Menu.Item>
  );
}
