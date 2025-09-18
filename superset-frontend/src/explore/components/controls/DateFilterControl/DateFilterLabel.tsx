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
import { ReactNode, useState, useEffect, useMemo } from 'react';
import { DateTime } from 'luxon';
import {
  css,
  styled,
  t,
  useTheme,
  NO_TIME_RANGE,
  SupersetTheme,
  useCSSTextTruncation,
  fetchTimeRange,
} from '@superset-ui/core';
import Button from 'src/components/Button';
import ControlHeader from 'src/explore/components/ControlHeader';
import Modal from 'src/components/Modal';
import { Divider } from 'src/components';
import Icons from 'src/components/Icons';
import Select from 'src/components/Select/Select';
import { Tooltip } from 'src/components/Tooltip';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import { SLOW_DEBOUNCE } from 'src/constants';
import { noOp } from 'src/utils/common';
import { getCurrentTimezone } from 'src/utils/dateUtils';
import ControlPopover from '../ControlPopover/ControlPopover';

import { DateFilterControlProps, FrameType } from './types';
import {
  DateFilterTestKey,
  FRAME_OPTIONS,
  guessFrame,
  useDefaultTimeFilter,
} from './utils';
import {
  CommonFrame,
  CalendarFrame,
  CustomFrame,
  DateLabel,
} from './components';
import { CurrentCalendarFrame } from './components/CurrentCalendarFrame';

const StyledRangeType = styled(Select)`
  width: 272px;
`;

const ContentStyleWrapper = styled.div`
  ${({ theme }) => css`
    .ant-row {
      margin-top: 8px;
    }

    .ant-input-number {
      width: 100%;
    }

    .ant-picker {
      padding: 4px 17px 4px;
      border-radius: 4px;
      width: 100%;
    }

    .ant-divider-horizontal {
      margin: 16px 0;
    }

    .control-label {
      font-size: 11px;
      font-weight: ${theme.typography.weights.medium};
      color: ${theme.colors.grayscale.light2};
      line-height: 16px;
      text-transform: uppercase;
      margin: 8px 0;
    }

    .vertical-radio {
      display: block;
      height: 40px;
      line-height: 40px;
    }

    .section-title {
      font-style: normal;
      font-weight: ${theme.typography.weights.bold};
      font-size: 15px;
      line-height: 24px;
      margin-bottom: 8px;
    }

    .control-anchor-to {
      margin-top: 16px;
    }

    .control-anchor-to-datetime {
      width: 217px;
    }

    .footer {
      text-align: right;
    }
  `}
`;

const IconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
  .error {
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

const getTooltipTitle = (
  isLabelTruncated: boolean,
  label: string | undefined,
  range: string | undefined,
) =>
  isLabelTruncated ? (
    <div>
      {label && <strong>{label}</strong>}
      {range && (
        <div
          css={(theme: SupersetTheme) => css`
            margin-top: ${theme.gridUnit}px;
          `}
        >
          {range}
        </div>
      )}
    </div>
  ) : (
    range || null
  );

/**
 * --- Timezone helpers (Luxon-based) ---
 * If ?timezone=XYZ is present, use that; otherwise default to 'Asia/Kolkata'.
 * We convert backend-evaluated UTC ranges into this timezone for display.
 */

// Use centralized timezone utility for consistency
const getTimezoneFromUrl = getCurrentTimezone;

// Format datetime for user-friendly display (only for UI, not API)
function formatDateTimeForDisplay(s: string, toTZ = 'Asia/Kolkata') {
  // Pattern for full ISO datetime stamps
  const isoRe =
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g;

  // Pattern for date-only formats (YYYY-MM-DD)
  const dateOnlyRe = /\d{4}-\d{2}-\d{2}(?!\d)/g;

  // Try full datetime format first
  const isoMatches = [...s.matchAll(isoRe)].map(m => m[0]);
  if (isoMatches.length >= 2) {
    const formatForDisplay = (iso: string) => {
      // If no offset, assume UTC
      const src = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
      const dt = new Date(src);

      // Format as user-friendly string in target zone
      return new Intl.DateTimeFormat('en-US', {
        timeZone: toTZ,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(dt);
    };

    const formattedStart = formatForDisplay(isoMatches[0]);
    const formattedEnd = formatForDisplay(isoMatches[1]);

    return s
      .replace(isoMatches[0], formattedStart)
      .replace(isoMatches[1], formattedEnd);
  }

  // Try date-only format (for Last/Previous/Current frames)
  const dateMatches = [...s.matchAll(dateOnlyRe)].map(m => m[0]);
  if (dateMatches.length >= 2) {
    const formatDateOnly = (dateStr: string) => {
      // Convert date-only to datetime at start of day in target timezone
      const dt = new Date(`${dateStr}T00:00:00`);

      return new Intl.DateTimeFormat('en-US', {
        timeZone: toTZ,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(dt);
    };

    const formattedStart = formatDateOnly(dateMatches[0]);
    const formattedEnd = formatDateOnly(dateMatches[1]);

    return s
      .replace(dateMatches[0], formattedStart)
      .replace(dateMatches[1], formattedEnd);
  }

  // Return original string if no recognized patterns
  return s;
}

export const getDateFromTimezone = (timezone: string) =>
  DateTime.now().setZone(timezone);
export const getEzTimezoneDate = (
  timezone: string,
  fn: 'startOf' | 'endOf',
  unit: 'day' | 'month' | 'year',
): string => {
  const date = getDateFromTimezone(timezone);
  // Convert boundary in TZ to UTC ISO string
  return date[fn](unit).toUTC().toISO() as string;
};

// Try to parse a naive "YYYY-MM-DD HH:mm:ss" or ISO-like string as UTC using Luxon
function parseNaiveUTC(input: string): DateTime | null {
  if (!input) return null;
  let iso = input.trim().replace(' ', 'T');
  const hasTZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  if (!hasTZ) iso += 'Z';
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  return dt.isValid ? dt : null;
}

// Convert a range string "start to end" (or "start : end") from UTC -> tz using Luxon
function convertRangeUTCToTZ(range: string, tz: string): string {
  if (!range) return range;
  const parts = range.split(/\s+(?:to|:)\s+/i);
  if (parts.length !== 2) return range;

  const startUTC = parseNaiveUTC(parts[0]);
  const endUTC = parseNaiveUTC(parts[1]);
  if (!startUTC || !endUTC) return range;

  const startStr = startUTC.setZone(tz).toFormat('yyyy-MM-dd HH:mm:ss ZZ');
  const endStr = endUTC.setZone(tz).toFormat('yyyy-MM-dd HH:mm:ss ZZ');
  return `${startStr} to ${endStr}`;
}

export default function DateFilterLabel(props: DateFilterControlProps) {
  const {
    onChange,
    onOpenPopover = noOp,
    onClosePopover = noOp,
    overlayStyle = 'Popover',
    isOverflowingFilterBar = false,
  } = props;
  const defaultTimeFilter = useDefaultTimeFilter();

  const value = props.value ?? defaultTimeFilter;
  const [actualTimeRange, setActualTimeRange] = useState<string>(value);

  const [show, setShow] = useState<boolean>(false);
  const guessedFrame = useMemo(() => guessFrame(value), [value]);
  const [frame, setFrame] = useState<FrameType>(guessedFrame);
  const [lastFetchedTimeRange, setLastFetchedTimeRange] = useState(value);
  const [timeRangeValue, setTimeRangeValue] = useState(value);
  const [validTimeRange, setValidTimeRange] = useState<boolean>(false);
  const [evalResponse, setEvalResponse] = useState<string>(value);
  const [tooltipTitle, setTooltipTitle] = useState<ReactNode | null>(value);
  const theme = useTheme();
  const [labelRef, labelIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  // Backend evaluates to UTC; we convert to the URL tz or default 'Asia/Kolkata' for display.
  const urlTZ = getTimezoneFromUrl();

  useEffect(() => {
    if (value === NO_TIME_RANGE) {
      setActualTimeRange(NO_TIME_RANGE);
      setTooltipTitle(null);
      setValidTimeRange(true);
      return;
    }
    fetchTimeRange(value, 'date').then(({ value: actualRange, error }) => {
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
        setTooltipTitle(value || null);
      } else {
        const convertedADR = actualRange
          ? convertRangeUTCToTZ(actualRange, urlTZ)
          : actualRange;

        /*
          HRT == human readable text
          ADR == actual datetime range
          +--------------+------+----------+--------+----------+-----------+
          |              | Last | Previous | Custom | Advanced | No Filter |
          +--------------+------+----------+--------+----------+-----------+
          | control pill | HRT  | HRT      | ADR    | ADR      |   HRT     |
          +--------------+------+----------+--------+----------+-----------+
          | tooltip      | ADR  | ADR      | HRT    | HRT      |   ADR     |
          +--------------+------+----------+--------+----------+-----------+
        */

        // Format ADR for user-friendly display (for "Actual time range" section)
        const formattedADR = convertedADR
          ? formatDateTimeForDisplay(convertedADR, urlTZ)
          : convertedADR;

        if (
          guessedFrame === 'Common' ||
          guessedFrame === 'Calendar' ||
          guessedFrame === 'Current'
        ) {
          // Pill shows HRT (value); tooltip shows ADR (user-friendly formatted)
          // "Actual time range" shows formatted ADR
          setActualTimeRange(value);
          setEvalResponse(formattedADR || ''); // Store formatted ADR for "Actual time range" display
          setTooltipTitle(
            getTooltipTitle(labelIsTruncated, value, formattedADR),
          );
        } else {
          // Pill shows ADR (user-friendly formatted); tooltip shows HRT (value)
          // "Actual time range" shows formatted ADR
          setActualTimeRange(formattedADR || '');
          setEvalResponse(formattedADR || ''); // Store formatted ADR for "Actual time range" display
          setTooltipTitle(
            getTooltipTitle(labelIsTruncated, formattedADR, value),
          );
        }
        setValidTimeRange(true);
      }
      setLastFetchedTimeRange(value);
    });
  }, [guessedFrame, labelIsTruncated, labelRef, value, urlTZ]);

  useDebouncedEffect(
    () => {
      if (timeRangeValue === NO_TIME_RANGE) {
        setEvalResponse(NO_TIME_RANGE);
        setLastFetchedTimeRange(NO_TIME_RANGE);
        setValidTimeRange(true);
        return;
      }
      if (lastFetchedTimeRange !== timeRangeValue) {
        fetchTimeRange(timeRangeValue, 'date').then(
          ({ value: actualRange, error }) => {
            if (error) {
              setEvalResponse(error || '');
              setValidTimeRange(false);
            } else {
              const previewADR = actualRange
                ? convertRangeUTCToTZ(actualRange, urlTZ)
                : actualRange;
              // Format the preview ADR for user-friendly display
              const formattedPreviewADR = previewADR
                ? formatDateTimeForDisplay(previewADR, urlTZ)
                : previewADR;
              setEvalResponse(formattedPreviewADR || '');
              setValidTimeRange(true);
            }
            setLastFetchedTimeRange(timeRangeValue);
          },
        );
      }
    },
    SLOW_DEBOUNCE,
    [timeRangeValue, lastFetchedTimeRange, urlTZ],
  );

  function onSave() {
    onChange(timeRangeValue);
    setShow(false);
    onClosePopover();
  }

  function onOpen() {
    setTimeRangeValue(value);
    setFrame(guessedFrame);
    setShow(true);
    onOpenPopover();
  }

  function onHide() {
    setTimeRangeValue(value);
    setFrame(guessedFrame);
    setShow(false);
    onClosePopover();
  }

  const toggleOverlay = () => {
    if (show) {
      onHide();
    } else {
      onOpen();
    }
  };

  function onChangeFrame(value: FrameType) {
    if (value === NO_TIME_RANGE) {
      setTimeRangeValue(NO_TIME_RANGE);
    }
    setFrame(value);
  }

  const overlayContent = (
    <ContentStyleWrapper>
      <div className="control-label">{t('RANGE TYPE')}</div>
      <StyledRangeType
        ariaLabel={t('RANGE TYPE')}
        options={FRAME_OPTIONS}
        value={frame}
        onChange={onChangeFrame}
      />
      <Divider />
      {frame === 'Common' && (
        <CommonFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Calendar' && (
        <CalendarFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Current' && (
        <CurrentCalendarFrame
          value={timeRangeValue}
          onChange={setTimeRangeValue}
        />
      )}
      {frame === 'Custom' && (
        <CustomFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      <Divider />
      <div>
        <div className="section-title">{t('Actual time range')}</div>
        {validTimeRange && <div>{evalResponse}</div>}
        {!validTimeRange && (
          <IconWrapper className="warning">
            <Icons.ErrorSolidSmall iconColor={theme.colors.error.base} />
            <span className="text error">{evalResponse}</span>
          </IconWrapper>
        )}
      </div>
      <Divider />
      <div className="footer">
        <Button
          buttonStyle="secondary"
          cta
          key="cancel"
          onClick={onHide}
          data-test={DateFilterTestKey.CancelButton}
        >
          {t('CANCEL')}
        </Button>
        <Button
          buttonStyle="primary"
          cta
          disabled={!validTimeRange}
          key="apply"
          onClick={onSave}
          data-test={DateFilterTestKey.ApplyButton}
        >
          {t('APPLY')}
        </Button>
      </div>
    </ContentStyleWrapper>
  );

  const title = (
    <IconWrapper>
      <Icons.EditAlt iconColor={theme.colors.grayscale.base} />
      <span className="text">{t('Edit time range')}</span>
    </IconWrapper>
  );

  const popoverContent = (
    <ControlPopover
      placement="right"
      trigger="click"
      content={overlayContent}
      title={title}
      defaultVisible={show}
      visible={show}
      onVisibleChange={toggleOverlay}
      overlayStyle={{ width: '600px' }}
      getPopupContainer={triggerNode =>
        isOverflowingFilterBar
          ? (triggerNode.parentNode as HTMLElement)
          : document.body
      }
      destroyTooltipOnHide
    >
      <Tooltip
        placement="top"
        title={tooltipTitle}
        getPopupContainer={trigger => trigger.parentElement as HTMLElement}
      >
        <DateLabel
          label={actualTimeRange}
          isActive={show}
          isPlaceholder={actualTimeRange === NO_TIME_RANGE}
          data-test={DateFilterTestKey.PopoverOverlay}
          ref={labelRef}
        />
      </Tooltip>
    </ControlPopover>
  );

  const modalContent = (
    <>
      <Tooltip
        placement="top"
        title={tooltipTitle}
        getPopupContainer={trigger => trigger.parentElement as HTMLElement}
      >
        <DateLabel
          onClick={toggleOverlay}
          label={actualTimeRange}
          isActive={show}
          isPlaceholder={actualTimeRange === NO_TIME_RANGE}
          data-test={DateFilterTestKey.ModalOverlay}
          ref={labelRef}
        />
      </Tooltip>
      {/* the zIndex value is from trying so that the Modal doesn't overlay the AdhocFilter */}
      <Modal
        title={title}
        show={show}
        onHide={toggleOverlay}
        width="600px"
        hideFooter
        zIndex={1030}
      >
        {overlayContent}
      </Modal>
    </>
  );

  return (
    <>
      <ControlHeader {...props} />
      {overlayStyle === 'Modal' ? modalContent : popoverContent}
    </>
  );
}
