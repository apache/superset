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
import { FC } from 'react';
import { t, tn } from '@apache-superset/core/ui';
import { AutoRefreshStatus } from '../../types/autoRefresh';

export interface StatusTooltipContentProps {
  status: AutoRefreshStatus;
  lastSuccessfulRefresh: number | null;
  lastAutoRefreshTime: number | null;
  refreshErrorCount: number;
  refreshFrequency: number;
  isPausedByTab?: boolean;
  /** Current timestamp for relative time calculations */
  currentTime: number;
}

/**
 * Calculates elapsed seconds between two timestamps.
 */
const getElapsedSeconds = (
  timestamp: number | null,
  currentTime: number,
): number | null => {
  if (timestamp === null) return null;
  return Math.max(0, Math.floor((currentTime - timestamp) / 1000));
};

/**
 * Formats elapsed seconds into a human-readable relative time string.
 */
const formatElapsedTime = (seconds: number): string => {
  if (seconds < 60) {
    return tn('%s s ago', '%s s ago', seconds, seconds);
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return tn('%s min ago', '%s min ago', minutes, minutes);
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return tn('%s hr ago', '%s hr ago', hours, hours);
  }

  const days = Math.floor(hours / 24);
  return tn('%s day ago', '%s days ago', days, days);
};

const getNextRefreshLabel = (nextRefreshInSeconds: number | null): string =>
  nextRefreshInSeconds === null
    ? t('a few seconds')
    : tn('%s second', '%s seconds', nextRefreshInSeconds, nextRefreshInSeconds);

const getLastUpdatedLine = (
  elapsedSeconds: number | null,
): string | undefined =>
  elapsedSeconds === null
    ? undefined
    : t('Last updated %s ago', formatElapsedTime(elapsedSeconds));

const getNextRefreshInSeconds = (
  lastAutoRefreshTime: number | null,
  currentTime: number,
  refreshFrequency: number,
): number | null => {
  if (refreshFrequency <= 0) {
    return null;
  }

  if (lastAutoRefreshTime === null) {
    return refreshFrequency;
  }

  const elapsedSeconds = Math.floor(
    Math.max(0, currentTime - lastAutoRefreshTime) / 1000,
  );

  return Math.max(0, refreshFrequency - elapsedSeconds);
};

export const StatusTooltipContent: FC<StatusTooltipContentProps> = ({
  status,
  lastSuccessfulRefresh,
  lastAutoRefreshTime,
  refreshErrorCount,
  refreshFrequency,
  isPausedByTab = false,
  currentTime,
}) => {
  const elapsedSeconds = getElapsedSeconds(lastSuccessfulRefresh, currentTime);
  const missedRefreshes = Math.max(0, refreshErrorCount);
  const nextRefreshInSeconds = getNextRefreshInSeconds(
    lastAutoRefreshTime,
    currentTime,
    refreshFrequency,
  );

  const intervalLine = t('Auto refresh set to %s seconds', refreshFrequency);

  const getUpdatedLine = (): string => {
    if (elapsedSeconds === null) {
      return t('Waiting for first refresh');
    }
    return t('Dashboard updated %s', formatElapsedTime(elapsedSeconds));
  };

  let line1: string;
  let line2: string | undefined = intervalLine;
  let line3: string | undefined;

  switch (status) {
    case AutoRefreshStatus.Fetching:
      line1 = t('Fetching data...');
      break;
    case AutoRefreshStatus.Delayed:
      line1 = getUpdatedLine();
      line3 =
        missedRefreshes > 0
          ? tn(
              'Delayed (missed %s refresh)',
              'Delayed (missed %s refreshes)',
              missedRefreshes,
              missedRefreshes,
            )
          : t('Refresh delayed');
      break;
    case AutoRefreshStatus.Error:
      line1 = t(
        "There was a problem refreshing your dashboard. We'll try again in %s, as scheduled.",
        getNextRefreshLabel(nextRefreshInSeconds),
      );
      line2 = getLastUpdatedLine(elapsedSeconds);
      line3 = undefined;
      break;
    case AutoRefreshStatus.Paused:
      line1 = getUpdatedLine();
      line2 = isPausedByTab
        ? t(
            'Auto refresh paused - tab inactive (set to %s seconds)',
            refreshFrequency,
          )
        : t('Auto refresh paused (set to %s seconds)', refreshFrequency);
      break;
    case AutoRefreshStatus.Success:
    case AutoRefreshStatus.Idle:
    default:
      line1 = getUpdatedLine();
      break;
  }

  return (
    <div data-test="status-tooltip-content">
      <div>{line1}</div>
      {line2 && <div>{line2}</div>}
      {line3 && <div>{line3}</div>}
    </div>
  );
};

export default StatusTooltipContent;
