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
import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { uniqueId } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import {
  NO_TIME_RANGE,
  SEPARATOR,
  fetchTimeRangeList,
  formatResolvedTimeRange,
  type Level,
  type TimeRangeLimits,
} from '@superset-ui/core';
import type { RefSelectProps } from '@superset-ui/core/components/Select/types';
import { Constants } from '@superset-ui/core/components';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import {
  LIMIT_REQUEST_OPTIONS,
  LimitCheck,
  allFailures,
  checkTimeRange,
  describeFailure,
  describeFirstFailure,
  describeLimits,
  hasLimits,
  isEndDayDisabled,
  isStartDayDisabled,
  limitsFor,
  parseServerDate,
} from 'src/utils/timeRangeLimits';
import { FrameLimits, FrameType } from './types';
import {
  CALENDAR_RANGE_OPTIONS,
  COMMON_RANGE_OPTIONS,
  COMMON_RANGE_VALUES_SET,
  CURRENT_RANGE_OPTIONS,
  DateFilterTestKey,
} from './utils';

export const PRESET_FRAMES: FrameType[] = ['Common', 'Calendar', 'Current'];

const PRESET_VALUES = [
  ...COMMON_RANGE_OPTIONS,
  ...CALENDAR_RANGE_OPTIONS,
  ...CURRENT_RANGE_OPTIONS,
].map(option => String(option.value));

const isOpenEnded = (timeRange: string) =>
  timeRange === NO_TIME_RANGE ||
  !timeRange.trim() ||
  (timeRange.includes(SEPARATOR) &&
    timeRange.split(SEPARATOR).some(part => !part.trim()));

async function checkPresets(
  levels: Level[],
  onDashboard: boolean,
): Promise<Record<string, string | undefined> | undefined> {
  const result = await fetchTimeRangeList(PRESET_VALUES, LIMIT_REQUEST_OPTIONS);
  if ('error' in result) {
    return undefined;
  }
  const limits = limitsFor(
    levels,
    parseServerDate(result.today),
    parseServerDate(result.now),
  );
  if (!limits || 'unavailable' in limits) {
    return undefined;
  }
  return Object.fromEntries(
    PRESET_VALUES.map((value, index) => {
      const since = parseServerDate(result.ranges[index].since);
      const until = parseServerDate(result.ranges[index].until);
      const failures = allFailures({ since, until }, limits);
      return [
        value,
        describeFirstFailure(
          failures,
          onDashboard,
          since && until && !COMMON_RANGE_VALUES_SET.has(value)
            ? { since, until }
            : undefined,
        ),
      ];
    }),
  );
}

/** The time range picker's limits state: the checks, ids and focus marks. */
export function useDateFilterLimitsState({
  limits,
  show,
}: {
  limits: TimeRangeLimits | undefined;
  show: boolean;
}) {
  const levels = limits?.levels;
  const limitsOn = !!levels && hasLimits(levels);
  const onDashboard = limits?.dashboardId !== undefined;
  const levelsKey = JSON.stringify(levels ?? null);
  const levelsRef = useRef<Level[]>([]);
  levelsRef.current = levels ?? [];
  const limitsOnRef = useRef(limitsOn);
  limitsOnRef.current = limitsOn;
  const showRef = useRef(show);
  showRef.current = show;
  const [ids] = useState(() => {
    const base = uniqueId('date-filter-');
    return {
      start: `${base}-start`,
      end: `${base}-end`,
      startError: `${base}-start-error`,
      endError: `${base}-end-error`,
      rowError: `${base}-row-error`,
      limitLine: `${base}-limit-line`,
      groupLabel: `${base}-group-label`,
      disabledPresets: `${base}-disabled-presets`,
      popover: `${base}-popover`,
    };
  });
  const [appliedCheck, setAppliedCheck] = useState<LimitCheck | null>(null);
  const [draftCheck, setDraftCheck] = useState<LimitCheck | null>(null);
  const draftRequest = useRef<{ timeRange: string } | null>(null);
  const [presets, setPresets] = useState<Record<string, string | undefined>>();
  const presetRequest = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const focusOnCheckRef = useRef(false);
  const rangeTypeRef = useRef<RefSelectProps>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function checkDraft(timeRange: string) {
    const request = { timeRange };
    draftRequest.current = request;
    checkTimeRange(timeRange, levelsRef.current).then(check => {
      if (draftRequest.current === request) {
        setDraftCheck(check);
      }
    });
  }

  /** On open: the draft starts from the applied check, and presets are checked. */
  function checkOnOpen(value: string) {
    setDraftCheck(
      appliedCheck && appliedCheck.timeRange === value
        ? { ...appliedCheck, seeded: true }
        : null,
    );
    focusOnCheckRef.current = true;
    checkDraft(value);
    setPresets(undefined);
    presetRequest.current += 1;
    const request = presetRequest.current;
    checkPresets(levelsRef.current, onDashboard).then(reasons => {
      if (presetRequest.current === request) {
        setPresets(reasons);
      }
    });
  }

  return {
    limits,
    limitsOn,
    onDashboard,
    levelsKey,
    levelsRef,
    limitsOnRef,
    showRef,
    ids,
    appliedCheck,
    setAppliedCheck,
    draftCheck,
    draftRequest,
    presets,
    contentRef,
    calendarOpen,
    setCalendarOpen,
    focusOnCheckRef,
    rangeTypeRef,
    triggerRef,
    checkDraft,
    checkOnOpen,
  };
}

type PickerLimits = ReturnType<typeof useDateFilterLimitsState>;

/**
 * Checks the applied value, for the label and its tooltip, and the draft
 * after each edit.
 */
export function useDateFilterChecks({
  picker,
  value,
  timeRangeValue,
  displayFormat,
  guessedFrame,
  labelIsTruncated,
  setActualTimeRange,
  setTooltipTitle,
  tooltipTitle,
}: {
  picker: PickerLimits;
  value: string;
  timeRangeValue: string;
  displayFormat?: string;
  guessedFrame: FrameType;
  labelIsTruncated: boolean;
  setActualTimeRange: (range: string) => void;
  setTooltipTitle: (title: ReactNode | null) => void;
  tooltipTitle: (
    isLabelTruncated: boolean,
    label: string | undefined,
    range: string | undefined,
  ) => ReactNode;
}) {
  const {
    limitsOn,
    levelsKey,
    levelsRef,
    limitsOnRef,
    showRef,
    draftRequest,
    setAppliedCheck,
    checkDraft,
  } = picker;

  useEffect(() => {
    if (!limitsOn) {
      return undefined;
    }
    let cancelled = false;
    checkTimeRange(value, levelsRef.current).then(check => {
      if (cancelled) {
        return;
      }
      setAppliedCheck(check);
      if (check.status !== 'checked') {
        setActualTimeRange(value);
        setTooltipTitle(value || null);
        return;
      }
      const actualRange = formatResolvedTimeRange(check.range, displayFormat);
      if (PRESET_FRAMES.includes(guessedFrame)) {
        setActualTimeRange(value);
        setTooltipTitle(tooltipTitle(labelIsTruncated, value, actualRange));
      } else {
        setActualTimeRange(actualRange);
        setTooltipTitle(tooltipTitle(labelIsTruncated, actualRange, value));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    displayFormat,
    guessedFrame,
    labelIsTruncated,
    levelsKey,
    limitsOn,
    value,
    levelsRef,
    setAppliedCheck,
    setActualTimeRange,
    setTooltipTitle,
    tooltipTitle,
  ]);

  useDebouncedEffect(
    () => {
      if (
        limitsOnRef.current &&
        showRef.current &&
        draftRequest.current?.timeRange !== timeRangeValue
      ) {
        checkDraft(timeRangeValue);
      }
    },
    Constants.SLOW_DEBOUNCE,
    [timeRangeValue],
  );
}

/**
 * What the open picker shows and does with limits on: field and row
 * errors, disabled days and presets, the limit line, and focus and keyboard
 * handling.
 */
export function useDateFilterLimitsView({
  picker,
  value,
  timeRangeValue,
  frame,
  show,
  onHide,
  name,
}: {
  picker: PickerLimits;
  value: string;
  timeRangeValue: string;
  frame: FrameType;
  show: boolean;
  onHide: () => void;
  name: string;
}) {
  const {
    limits,
    limitsOn,
    onDashboard,
    ids,
    appliedCheck,
    draftCheck,
    presets,
    contentRef,
    calendarOpen,
    setCalendarOpen,
    focusOnCheckRef,
    rangeTypeRef,
    triggerRef,
  } = picker;
  const draftPending =
    !draftCheck ||
    !!draftCheck.seeded ||
    draftCheck.timeRange !== timeRangeValue;
  const checked = draftCheck?.status === 'checked' ? draftCheck : null;
  const failures = checked?.failures ?? [];
  const draftValid = !draftPending && !!checked && !failures.length;
  const fieldFrame = frame === 'Custom' || frame === 'Advanced';
  const fieldMessage = (field: 'start' | 'end') => {
    const messages = fieldFrame
      ? failures.filter(failure => failure.field === field)
      : [];
    return messages.length
      ? messages.map(failure => describeFailure(failure, onDashboard)).join(' ')
      : undefined;
  };
  const startMessage = fieldMessage('start');
  const endMessage = fieldMessage('end');
  const rowFailures = failures.filter(
    failure => !fieldFrame || failure.field === 'range',
  );
  const rowMessages: string[] = [];
  if (draftCheck?.status === 'error') {
    rowMessages.push(draftCheck.message);
  } else if (draftCheck?.status === 'unavailable') {
    rowMessages.push(t('Time range could not be checked.'));
  } else {
    rowFailures.forEach(failure =>
      rowMessages.push(describeFailure(failure, onDashboard)),
    );
  }
  const rowInvalid =
    draftCheck?.status === 'error' ||
    rowFailures.some(failure => failure.reason !== 'NO_VALID_RANGE');
  const spanErrorShown = failures.some(
    failure => failure.reason === 'MAX_SPAN_EXCEEDED',
  );
  const shownLimits =
    checked ?? (appliedCheck?.status === 'checked' ? appliedCheck : null);
  const limitLine =
    limitsOn && shownLimits
      ? describeLimits(
          shownLimits.limits,
          !draftPending && checked
            ? parseServerDate(checked.range.until)
            : null,
          shownLimits.today,
          limits?.timezone,
          onDashboard,
        )
      : null;
  const dayLimits = shownLimits?.limits;
  const frameLimits: FrameLimits | undefined = limitsOn
    ? {
        startId: ids.start,
        endId: ids.end,
        start: startMessage
          ? { id: ids.startError, message: startMessage }
          : undefined,
        end: endMessage ? { id: ids.endError, message: endMessage } : undefined,
        rowErrorId: rowMessages.length ? ids.rowError : undefined,
        rowInvalid,
        presetInvalid: !draftPending && rowInvalid ? true : undefined,
        presetDescribedBy:
          !draftPending && rowMessages.length ? ids.rowError : undefined,
        pending: draftPending,
        disabledStartDate: dayLimits
          ? current => isStartDayDisabled(current, dayLimits)
          : undefined,
        disabledEndDate: dayLimits
          ? current => isEndDayDisabled(current, dayLimits)
          : undefined,
        presets,
        groupLabelId: ids.groupLabel,
        disabledPresetsId: ids.disabledPresets,
        limitLineId: limitLine?.line ? ids.limitLine : undefined,
        onCalendarOpenChange: setCalendarOpen,
      }
    : undefined;
  const appliedFails =
    !!appliedCheck &&
    appliedCheck.timeRange === value &&
    (appliedCheck.status !== 'checked' || appliedCheck.failures.length > 0);
  const appliedOpenEnded =
    limitsOn &&
    (isOpenEnded(value) ||
      (appliedCheck?.status === 'checked' &&
        appliedCheck.timeRange === value &&
        (!appliedCheck.range.since || !appliedCheck.range.until)));

  function focusFirstInvalid() {
    const target = fieldFrame
      ? document.getElementById(
          endMessage && !startMessage ? ids.end : ids.start,
        )
      : contentRef.current?.querySelector<HTMLElement>(
          'input[type="radio"]:checked',
        );
    target?.focus();
    return !!target;
  }

  // An open Select list stops its own Escape, an open calendar doesn't: that
  // Escape only closes the calendar. Any other Escape, and Tab out of either
  // end of the content, close the picker instead of reaching the page or
  // modal behind it.
  function onContentKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    focusOnCheckRef.current = false;
    if (limitsOn && event.key === 'Escape') {
      event.stopPropagation();
      if (!calendarOpen) {
        event.preventDefault();
        onHide();
      }
      return;
    }
    if (limitsOn && event.key === 'Tab') {
      const content = contentRef.current;
      const first = content?.querySelector('input[role="combobox"]');
      const last = content?.querySelector(
        `[data-test="${
          draftValid
            ? DateFilterTestKey.ApplyButton
            : DateFilterTestKey.CancelButton
        }"]`,
      );
      if (event.target === (event.shiftKey ? first : last)) {
        event.preventDefault();
        onHide();
      }
      return;
    }
    if (!limitsOn || event.key !== 'Enter' || event.defaultPrevented) {
      return;
    }
    const target = event.target as HTMLInputElement;
    const fromPreset = PRESET_FRAMES.includes(frame) && target.type === 'radio';
    const fromAdvanced =
      frame === 'Advanced' &&
      (target.id === ids.start || target.id === ids.end);
    if ((fromPreset || fromAdvanced) && !draftPending && !draftValid) {
      focusFirstInvalid();
    }
  }

  function afterOpenChange(open: boolean) {
    if (!limitsOn) {
      return;
    }
    if (open) {
      if (!contentRef.current?.contains(document.activeElement)) {
        rangeTypeRef.current?.focus();
      }
    } else {
      // Restore after the closing pointer event has assigned its focus.
      requestAnimationFrame(() => {
        if (
          !picker.showRef.current &&
          (!document.activeElement ||
            document.activeElement === document.body ||
            contentRef.current?.contains(document.activeElement))
        ) {
          triggerRef.current?.focus();
        }
      });
    }
  }

  useEffect(() => {
    if (limitsOn && focusOnCheckRef.current && show && !draftPending) {
      if (draftValid || focusFirstInvalid()) {
        focusOnCheckRef.current = false;
      }
    }
  });

  let openEndedLabel: string | undefined;
  if (appliedOpenEnded) {
    openEndedLabel =
      limits?.dashboardId !== undefined
        ? t("Select a time range within this dashboard's limits.")
        : t('Choose a start and an end date. Time range limits are on.');
  }

  return {
    frameLimits,
    afterOpenChange,
    draftValid,
    appliedOpenEnded,
    onContentKeyDown,
    openEndedLabel,
    labelProps: limitsOn
      ? {
          accessible: true,
          'aria-labelledby': [limits?.labelledBy, `date-label-${name}`]
            .filter(Boolean)
            .join(' '),
          'aria-describedby': [`date-label-${name}`, limits?.describedBy]
            .filter(Boolean)
            .join(' '),
          'aria-expanded': show,
          'aria-controls': show ? ids.popover : undefined,
          'aria-invalid':
            limits?.describedBy || appliedFails ? true : undefined,
        }
      : undefined,
    row: {
      checked,
      spanErrorShown,
      rowMessages,
      limitLine,
      onDashboard,
      rowErrorId: ids.rowError,
      limitLineId: ids.limitLine,
    },
  };
}

/** The "Actual time range" row with limits on. */
export function LimitsTimeRangeRow({
  row,
  displayFormat,
  renderError,
}: {
  row: ReturnType<typeof useDateFilterLimitsView>['row'];
  displayFormat?: string;
  renderError: (message: string) => ReactNode;
}) {
  const {
    checked,
    spanErrorShown,
    rowMessages,
    limitLine,
    onDashboard,
    rowErrorId,
    limitLineId,
  } = row;
  return (
    <div>
      <div className="section-title">{t('Actual time range')}</div>
      {checked && !spanErrorShown && (
        <div>{formatResolvedTimeRange(checked.range, displayFormat)}</div>
      )}
      {rowMessages.length > 0 && (
        <div id={rowErrorId} role="alert">
          {rowMessages.map(message => (
            <div key={message}>{renderError(message)}</div>
          ))}
        </div>
      )}
      {limitLine?.line &&
        (onDashboard ? (
          <div id={limitLineId}>
            <div>{limitLine.line}</div>
            {limitLine.timezone && <div>{limitLine.timezone}</div>}
          </div>
        ) : (
          <div id={limitLineId}>
            {[limitLine.line, limitLine.timezone].filter(Boolean).join(' ')}
          </div>
        ))}
    </div>
  );
}
