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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { Button } from '@superset-ui/core/components';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { RootState } from 'src/dashboard/types';
import { acknowledgeEditorNotice } from 'src/dashboard/actions/timeRangeLimits';
import {
  describeLimitParts,
  effectiveLimits,
  type DashboardLimitsPayload,
} from 'src/utils/timeRangeLimits';
import { limitAlertIcon } from 'src/components/TimeRangeLimits/limitAlertIcon';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where focus goes once "Got it" hides the notice: the time range limits
 * alert's first button, else the first focusable element of the dashboard
 * content, else the header's edit button.
 */
export function noticeFocusTarget(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(
      '[data-test="time-range-limits-alert"] button',
    ) ??
    document
      .querySelector('.dashboard-content')
      ?.querySelector<HTMLElement>(FOCUSABLE) ??
    document.querySelector<HTMLElement>('[data-test="edit-dashboard-button"]')
  );
}

const limitsText = (payload: DashboardLimitsPayload): string => {
  const now = extendedDayjs.utc(extendedDayjs().format('YYYY-MM-DDTHH:mm:ss'));
  const today = now.startOf('day');
  const limits = effectiveLimits(
    [{ source: 'global', policy: payload.global }],
    today,
    now,
  );
  return limits && !('unavailable' in limits)
    ? describeLimitParts(limits, null, today)
    : '';
};

/**
 * The one-time notice for a dashboard editor when the admin turned the global
 * time range limits on or made them stricter. "Got it" stores the
 * limits as seen and hides the notice for the rest of the page, whatever
 * the call answers. Never shown in a standalone view (embedded, reports).
 */
export default function TimeRangeLimitsEditorNotice() {
  const payload = useSelector<
    RootState,
    DashboardLimitsPayload | null | undefined
  >(state => state.timeRangeLimits.payload);
  const [hidden, setHidden] = useState(false);
  const moveFocus = useRef(false);

  useEffect(() => {
    if (hidden && moveFocus.current) {
      moveFocus.current = false;
      noticeFocusTarget()?.focus();
    }
  }, [hidden]);

  const kind = payload?.editor_notice?.kind;
  const limits = useMemo(
    () => (payload && kind ? limitsText(payload) : ''),
    [payload, kind],
  );

  if (hidden || !kind || !limits || getUrlParam(URL_PARAMS.standalone)) {
    return null;
  }

  const gotIt = () => {
    moveFocus.current = true;
    setHidden(true);
    acknowledgeEditorNotice();
  };

  return (
    <Alert
      data-test="time-range-limits-editor-notice"
      type="info"
      banner
      icon={limitAlertIcon('info')}
      closable={false}
      showIcon
      action={
        <Button buttonSize="small" onClick={gotIt}>
          {t('Got it')}
        </Button>
      }
    >
      {kind === 'tightened'
        ? t('Your admin changed time range limits: %(limits)s.', {
            limits,
          })
        : t('Your admin turned on time range limits: %(limits)s.', {
            limits,
          })}
    </Alert>
  );
}
