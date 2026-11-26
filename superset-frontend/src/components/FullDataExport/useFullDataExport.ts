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

/**
 * Requesting an uncapped export, and waiting for it without having to.
 *
 * The export runs in a worker and is delivered by an emailed link, so the
 * request is finished the moment it is queued. While the page stays open this
 * also polls for the file and downloads it as soon as it is ready, so a user
 * who waits does not have to go to their inbox. A user who navigates away
 * loses nothing: the email is the delivery mechanism, the polling is a
 * courtesy.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getClientErrorObject,
  JsonObject,
  SupersetClient,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import getBootstrapData from 'src/utils/getBootstrapData';

export const POLL_INTERVAL_MS = 5000;

/**
 * How long to keep polling before leaving the rest to the email. An uncapped
 * export is bounded by the server's own time limit, which can be far longer
 * than anyone wants to watch a spinner for.
 */
export const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const STATUS_ENDPOINT = '/api/v1/data_export/status';

interface StatusResponse {
  status: 'pending' | 'running' | 'ready' | 'error';
  download_url?: string;
  row_count?: number;
  message?: string;
}

interface PollState {
  deadline: number;
  sawRunning: boolean;
}

/**
 * The file an uncapped export is delivered as. CSV is the default; an Excel
 * export spreads results across continuation sheets past a worksheet's row
 * limit rather than truncating.
 */
export type FullDataExportFormat = 'csv' | 'xlsx';

export interface FullDataExportRequest {
  /** The endpoint that queues the export for this kind of data. */
  endpoint: string;
  jsonPayload?: JsonObject;
}

/**
 * Whether this deployment offers uncapped exports. The backend reports the
 * feature flag and the storage/worker setup as one value, so the action is
 * never offered when the request behind it would be refused.
 */
export function isFullDataExportAvailable(): boolean {
  return Boolean(getBootstrapData()?.common?.conf?.FULL_DATA_EXPORT_AVAILABLE);
}

export const useFullDataExport = () => {
  const { addDangerToast, addInfoToast, addSuccessToast } = useToasts();
  const [isExporting, setIsExporting] = useState(false);
  const unmountedRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(
    () => () => {
      unmountedRef.current = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    },
    [],
  );

  const triggerDownload = useCallback(
    async (downloadUrl: string) => {
      // A plain anchor to the attachment streams it to disk without leaving
      // the page or needing a frame (so no frame-src CSP exception). No
      // `download` attribute: by now polling has consumed any user
      // activation, and Chrome drops such clicks silently. An error response
      // would navigate instead, so confirm the exact link first and report a
      // failure as a toast.
      try {
        const probe = await fetch(downloadUrl, {
          method: 'HEAD',
          credentials: 'same-origin',
        });
        if (!probe.ok) {
          throw new Error(`download link answered ${probe.status}`);
        }
      } catch (error) {
        logging.error(error);
        if (!unmountedRef.current) {
          addDangerToast(
            t(
              'Your export is ready but could not be downloaded here. Use the link in the email instead.',
            ),
          );
        }
        return;
      }
      if (unmountedRef.current) {
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [addDangerToast],
  );

  const poll = useCallback(
    (jobId: string, pollState: PollState) => {
      if (unmountedRef.current) {
        return;
      }
      SupersetClient.get({ endpoint: `${STATUS_ENDPOINT}/${jobId}/` })
        .then(({ json }: { json?: JsonObject }) => {
          // A response in flight when the component unmounts must not toast
          // on whatever page the user moved to.
          if (unmountedRef.current) {
            return;
          }
          const {
            status,
            download_url: downloadUrl,
            row_count: rowCount,
            message,
          } = json as StatusResponse;

          if (status === 'ready') {
            setIsExporting(false);
            addSuccessToast(
              rowCount === undefined
                ? t('Your export is ready and downloading.')
                : t('Your export is ready and downloading (%(rows)s rows).', {
                    rows: rowCount.toLocaleString(),
                  }),
            );
            if (downloadUrl) {
              triggerDownload(downloadUrl);
            }
            return;
          }
          if (status === 'error') {
            setIsExporting(false);
            addDangerToast(
              message || t('Sorry, something went wrong. Try again later.'),
            );
            return;
          }
          if (status === 'running' && !pollState.sawRunning) {
            // The export's own time budget only starts when a worker picks
            // the job up; restart the wait window then, so queue delay does
            // not eat it.
            pollState.sawRunning = true;
            pollState.deadline = Date.now() + POLL_TIMEOUT_MS;
          }
          if (Date.now() > pollState.deadline) {
            // Not a failure: the export is still running, and the email is
            // how it was always going to arrive.
            setIsExporting(false);
            addInfoToast(
              t(
                'Your export is still running. You will receive an email with a download link when it is ready.',
              ),
            );
            return;
          }
          pollTimerRef.current = setTimeout(
            () => poll(jobId, pollState),
            POLL_INTERVAL_MS,
          );
        })
        .catch((error: unknown) => {
          if (unmountedRef.current) {
            return;
          }
          // A transient polling failure should not give up the wait -- the
          // export itself may still succeed -- so keep polling until the
          // window closes.
          logging.error(error);
          if (Date.now() > pollState.deadline) {
            setIsExporting(false);
            addInfoToast(
              t(
                'Your export is still running. You will receive an email with a download link when it is ready.',
              ),
            );
            return;
          }
          pollTimerRef.current = setTimeout(
            () => poll(jobId, pollState),
            POLL_INTERVAL_MS,
          );
        });
    },
    [addDangerToast, addInfoToast, addSuccessToast, triggerDownload],
  );

  const requestExport = useCallback(
    async ({ endpoint, jsonPayload }: FullDataExportRequest) => {
      setIsExporting(true);
      try {
        const response = await SupersetClient.post({
          endpoint,
          jsonPayload: jsonPayload ?? {},
          // A retry would hit the first request's in-flight lock and be
          // refused, losing the job id of the export that is already running.
          fetchRetryOptions: { retries: 0 },
        });
        if (unmountedRef.current) {
          return;
        }
        const { job_id: jobId } = (response.json ?? {}) as { job_id?: string };
        if (!jobId) {
          setIsExporting(false);
          addDangerToast(t('Sorry, something went wrong. Try again later.'));
          return;
        }
        addInfoToast(
          t(
            'Preparing your full export. You will receive an email with a download link when it is ready.',
          ),
        );
        pollTimerRef.current = setTimeout(
          () =>
            poll(jobId, {
              deadline: Date.now() + POLL_TIMEOUT_MS,
              sawRunning: false,
            }),
          POLL_INTERVAL_MS,
        );
      } catch (error) {
        const { status, message } = (await getClientErrorObject(error)) as {
          status?: number;
          message?: unknown;
        };
        if (unmountedRef.current) {
          return;
        }
        setIsExporting(false);
        // Show actionable client errors -- an export already in progress, a
        // deployment without background exports -- and keep server errors
        // generic.
        if (
          typeof message === 'string' &&
          message &&
          status &&
          status >= 400 &&
          status < 500
        ) {
          addDangerToast(message);
        } else {
          addDangerToast(t('Sorry, something went wrong. Try again later.'));
        }
      }
    },
    [addDangerToast, addInfoToast, poll],
  );

  return {
    isAvailable: isFullDataExportAvailable(),
    isExporting,
    requestExport,
  };
};
