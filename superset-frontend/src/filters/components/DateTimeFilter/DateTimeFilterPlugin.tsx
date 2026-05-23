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
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { NO_TIME_RANGE, fetchTimeRange, SEPARATOR } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import {
  RangePicker,
  Button,
  Divider,
  AntdThemeProvider,
  InfoTooltip,
} from '@superset-ui/core/components';
import {
  CommonFrame,
  CalendarFrame,
  CurrentCalendarFrame,
  CustomFrame,
} from 'src/explore/components/controls/DateFilterControl/components';
import ControlPopover from 'src/explore/components/controls/ControlPopover/ControlPopover';
import {
  DateFilterTestKey,
} from 'src/explore/components/controls/DateFilterControl/utils';
import { FilterPluginStyle } from '../common';
import { PluginFilterDateTimeProps } from './types';
import { useLocale } from 'src/hooks/useLocale';
import dayjs from 'dayjs';


// Matches date strings returned by fetchTimeRange, e.g.:
//   "2026-04-23 ≤ col < 2026-04-29"
//   "2026-04-23 00:00:00 ≤ col < 2026-04-29 00:00:00"
const RESOLVED_DATE_RE = /(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}:\d{2})?)/g;


/* ------------------------------------------------------------------ */
/*  Frame → Tab mapping                                                 */
/* ------------------------------------------------------------------ */


type TabKey = 'basic' | 'last' | 'previous' | 'current' | 'custom' | 'advanced';


const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'last', label: 'Last' },
  { key: 'previous', label: 'Previous' },
  { key: 'current', label: 'Current' },
  { key: 'custom', label: 'Custom' },
];




/* ------------------------------------------------------------------ */
/*  Styled wrappers                                                     */
/* ------------------------------------------------------------------ */


const DateTimeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;
`;


const ControlContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  display: flex;
  height: 100%;
  max-width: 100%;
  width: 100%;


  & > .ant-picker {
    width: 100%;
    flex: 1;
  }
`;


const PopoverContent = styled.div`
  width: 600px;
  max-width: 90vw;


  .tab-nav {
    display: flex;
    border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
    padding: 0 8px;
    margin-bottom: 0;
  }


  .tab-nav-item {
    padding: 6px 10px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: ${({ theme }) => theme.colorTextSecondary};
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.2s;


    &:hover {
      color: ${({ theme }) => theme.colorPrimary};
    }


    &.active {
      color: ${({ theme }) => theme.colorPrimary};
      border-bottom-color: ${({ theme }) => theme.colorPrimary};
    }
  }


  .tab-body {
    padding: 8px 16px;
    min-height: 100px;


    .section-title {
      font-weight: 600;
      font-size: 13px;
      line-height: 20px;
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }


    .control-label {
      font-size: 11px;
      font-weight: 500;
      color: ${({ theme }) => theme.colorTextSecondary};
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }


    .ant-input {
      background: ${({ theme }) => theme.colorBgContainer} !important;
      border: 1px solid ${({ theme }) => theme.colorBorder} !important;
      color: ${({ theme }) => theme.colorText} !important;
      padding: 6px 12px;
      font-size: 12px;
      border-radius: 4px;


      &:focus {
        border-color: ${({ theme }) => theme.colorPrimary} !important;
        box-shadow: 0 0 0 2px ${({ theme }) => theme.colorPrimary}22 !important;
      }


      &::placeholder {
        color: ${({ theme }) => theme.colorTextPlaceholder || theme.colorTextQuaternary} !important;
      }
    }


    .ant-row { margin-top: 8px; }
    .ant-picker { padding: 4px 17px 4px; border-radius: 4px; }
    .ant-divider-horizontal { margin: 16px 0; border-color: #2d3134; }
    .control-anchor-to { margin-top: 16px; }
    .control-anchor-to-datetime { width: 217px; }
  }
`;


const ActualTimeRange = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colorText};
  padding: 4px 0;
  font-family: ${({ theme }) => theme.fontFamilyCode};
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;


  .label {
    font-size: 11px;
    font-weight: 500;
    color: ${({ theme }) => theme.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }
`;


/**
 * Container that holds the inline calendar.
 *
 * The RangePicker renders two elements:
 *   1. The <input> row — we collapse it to zero height so it's invisible.
 *   2. The dropdown panel — we un-position it so it flows inline in the div.
 *
 * pointer-events on the input are set to none so clicks pass through to the
 * calendar panels, which explicitly restore pointer-events.
 */
const InlineCalendarContainer = styled.div`
  position: relative;
  /* Enough height for two calendar months side by side */
  min-height: 290px;
  margin-bottom: 12px;


  /* Collapse the picker INPUT element */
  .ant-picker {
    position: absolute !important;
    top: 0;
    left: 0;
    width: 0 !important;
    height: 0 !important;
    padding: 0 !important;
    border: none !important;
    overflow: hidden !important;
    pointer-events: none !important;
    opacity: 0 !important;
  }


  /* Make the dropdown render statically inside this div */
  .ant-picker-dropdown {
    position: static !important;
    box-shadow: none !important;
    padding: 0 !important;
    background: transparent !important;
  }


  .ant-picker-panel-container {
    box-shadow: none !important;
    border: none !important;
    background: transparent !important;
  }


  .ant-picker-header-view {
    font-weight: 600;
    font-size: 13px;
    letter-spacing: -0.01em;
  }


  .ant-picker-content th {
    font-size: 11px;
    color: #52595d;
    font-weight: 500;
  }


  /* Range selection colors — Preset Green */
  .ant-picker-cell-in-view.ant-picker-cell-in-range::before {
    background: ${({ theme }) => theme.colorPrimary}22 !important;
  }
  .ant-picker-cell-in-view.ant-picker-cell-range-start .ant-picker-cell-inner,
  .ant-picker-cell-in-view.ant-picker-cell-range-end .ant-picker-cell-inner {
    background: ${({ theme }) => theme.colorPrimary} !important;
    color: #fff !important;
  }
  .ant-picker-cell-in-view.ant-picker-cell-today .ant-picker-cell-inner::before {
    border-color: ${({ theme }) => theme.colorPrimary} !important;
  }


  /* Restore click events on the actual calendar UI */
  .ant-picker-panel-container,
  .ant-picker-panels,
  .ant-picker-panel,
  .ant-picker-body,
  .ant-picker-content,
  .ant-picker-header,
  table,
  th,
  td {
    pointer-events: auto !important;
  }
`;


const StatusTag = styled.span`
  background: #00a86b22;
  color: #00a86b;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;


  &::before {
    content: '';
    width: 6px;
    height: 6px;
    background: #00a86b;
    border-radius: 50%;
  }
`;


const InputWrapper = styled.div`
  position: relative;
  width: 100%;


  .clear-icon {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    color: ${({ theme }) => theme.colorTextDescription || theme.colorTextTertiary || '#52595d'};
    font-size: 12px;
    transition: color 0.2s;
   
    &:hover {
      color: ${({ theme }) => theme.colorText};
    }
  }
`;


/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */


export default function DateTimeFilterPlugin(props: PluginFilterDateTimeProps) {
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    inputRef,
    isOverflowingFilterBar = false,
    formData,
  } = props;


  const col: string = (formData as any).columnName?.trim() || '';


  // ---- State ----
  const [show, setShow] = useState(false);
  const [timeRangeValue, setTimeRangeValue] = useState<string>(NO_TIME_RANGE);
  const [triggerDates, setTriggerDates] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null]
  >([null, null]);
  const [evalResponse, setEvalResponse] = useState<string>('');
  const [validTimeRange, setValidTimeRange] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  // Bump to re-mount the inline RangePicker after the popover finishes animating in
  const [calendarKey, setCalendarKey] = useState(0);


  const datePickerLocale = useLocale();
  const calendarContainerRef = useRef<HTMLDivElement>(null);


  // Parse since/until for the inline calendar value
  const [since, until] = useMemo(() => {
    if (
      timeRangeValue &&
      timeRangeValue !== NO_TIME_RANGE &&
      timeRangeValue.includes(SEPARATOR)
    ) {
      const parts = timeRangeValue.split(SEPARATOR);
      return [parts[0]?.trim() || '', parts[1]?.trim() || ''];
    }
    return ['', ''];
  }, [timeRangeValue]);


  const calValue: [dayjs.Dayjs | null, dayjs.Dayjs | null] = useMemo(() => {
    // If we have a successful resolved range string (e.g. "2026-04-23 <= col < 2026-04-29"),
    // use those dates to drive the calendar highlights even if the input is a formula.
    if (evalResponse && !evalResponse.includes('Invalid') && evalResponse.includes('col')) {
      const matches = [...evalResponse.matchAll(RESOLVED_DATE_RE)];
      if (matches.length >= 2) {
        const start = dayjs(matches[0][1]);
        const end = dayjs(matches[1][1]);
        if (start.isValid() && end.isValid()) {
          return [start, end];
        }
      }
    }


    // Fallback to direct parsing if it's a fixed date string
    return [
      since && dayjs(since).isValid() ? dayjs(since) : null,
      until && dayjs(until).isValid() ? dayjs(until) : null,
    ];
  }, [since, until, evalResponse]);


  // Determine the default picker view (show the end of the range)
  const defaultPickerValue: [dayjs.Dayjs, dayjs.Dayjs] | undefined = useMemo(() => {
    const end = calValue[1] || dayjs();
    if (end.isValid()) {
      return [end.subtract(1, 'month'), end];
    }
    return undefined;
  }, [calValue]);



  /* ---- Resolve filterState.value → trigger display --------------- */
  // Watch the dashboard's confirmed value and derive actual dates for the
  // trigger RangePicker display. This survives re-mounts and page reloads.
  useEffect(() => {
    const value = (filterState.value as string) || NO_TIME_RANGE;
    if (!value || value === NO_TIME_RANGE) {
      setTriggerDates([null, null]);
      return;
    }


    // Synchronous path: value is already ISO date strings (e.g. "2026-04-01 : 2026-05-01")
    if (value.includes(SEPARATOR)) {
      const parts = value.split(SEPARATOR);
      const s = parts[0]?.trim() ?? '';
      const e = parts[1]?.trim() ?? '';
      const start = s && dayjs(s).isValid() ? dayjs(s) : null;
      const end = e && dayjs(e).isValid() ? dayjs(e) : null;
      // ONLY use the fast path if BOTH are valid dates.
      // If either is a formula (invalid dayjs), we must use the async fetchTimeRange path.
      if (start && end) {
        setTriggerDates([start, end]);
        return;
      }
    }


    // Async path: resolve formula strings (e.g. "30 days ago : now")
    fetchTimeRange(value).then(({ value: resolved, error }) => {
      if (!error && resolved) {
        const matches = [...resolved.matchAll(RESOLVED_DATE_RE)];
        if (matches.length >= 2) {
          setTriggerDates([
            dayjs(matches[0][1]).isValid() ? dayjs(matches[0][1]) : null,
            dayjs(matches[1][1]).isValid() ? dayjs(matches[1][1]) : null,
          ]);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.value]);
  useEffect(() => {
    if (show && activeTab === 'basic') {
      // Small delay allows the popover animation to finish before mounting
      const timer = setTimeout(() => setCalendarKey(k => k + 1), 80);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [show, activeTab]);


  /* ---- Resolve actual time range preview ------------------------- */
  useEffect(() => {
    let isCurrent = true;
    if (!timeRangeValue || timeRangeValue === NO_TIME_RANGE) {
      setEvalResponse('');
      setValidTimeRange(true);
      return undefined;
    }
    fetchTimeRange(timeRangeValue).then(({ value: resolved, error }) => {
      if (!isCurrent) return;
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
      } else {
        setEvalResponse(resolved || '');
        setValidTimeRange(true);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [timeRangeValue, t]);


  /* ---- Emit filter ---------------------------------------------- */
  const emitFilter = useCallback(
    async (rangeStr: string) => {
      const isSet = rangeStr && rangeStr !== NO_TIME_RANGE;
      if (!isSet) {
        setDataMask({
          extraFormData: { filters: [] },
          filterState: { value: null, label: '' },
        });
        return;
      }


      const extra: Record<string, any> = { time_range: rangeStr };


      try {
        const { value: resolved, error } = await fetchTimeRange(rangeStr);
        if (!error && resolved) {
          const matches = [...resolved.matchAll(RESOLVED_DATE_RE)];
          if (matches.length >= 2) {
            const start = matches[0][1];
            const end = matches[1][1];
            if (col) {
              extra.filters = [
                { col, op: '>=', val: start },
                { col, op: '<=', val: end },
              ];
            }
          }
        }
      } catch {
        // fall back to time_range only
      }


      setDataMask({
        extraFormData: extra,
        filterState: { value: rangeStr, label: rangeStr },
      });
    },
    [col, setDataMask],
  );


  /* ---- Popover lifecycle ----------------------------------------- */
  function onOpen() {
    const current = (filterState.value as string) || NO_TIME_RANGE;
    setTimeRangeValue(current);
    // Always open on Basic tab so the inline calendar is shown immediately
    setActiveTab('basic');
    setShow(true);
    setFilterActive(true);
  }


  function onClose() {
    setShow(false);
    setFilterActive(false);
    unsetFocusedFilter();
    unsetHoveredFilter();
  }


  async function onApply() {
    await emitFilter(timeRangeValue);
    onClose();
  }


  function onTabChange(key: TabKey) {
    setActiveTab(key);
    if (key !== 'basic') {
      setTimeRangeValue(NO_TIME_RANGE);
    }
  }


  /* ---- Apply on mount if existing value -------------------------- */
  useEffect(() => {
    if (filterState.value) {
      emitFilter(filterState.value as string);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /* ---- Tab content ---------------------------------------------- */
  const frameProps = {
    value: timeRangeValue,
    onChange: setTimeRangeValue,
    isOverflowingFilterBar,
  };


  // ---- Helpers ----
  const isDynamic = (val: string) => {
    if (!val) return false;
    const lower = val.toLowerCase();
    if (lower === 'now' || lower === 'today' || lower.includes('ago') || lower.includes('last')) return true;
    return !/^\d{4}-\d{2}-\d{2}/.test(val);
  };


  const isRangeDynamic = isDynamic(since) || isDynamic(until);


  const renderBasicTab = () => (
    <AntdThemeProvider locale={datePickerLocale ?? undefined}>
      {/* Inline dual-month calendar */}
      <InlineCalendarContainer ref={calendarContainerRef}>
        <RangePicker
          key={calendarKey}
          open
          value={calValue}
          defaultPickerValue={defaultPickerValue}
          onChange={(dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
            if (dates && dates[0] && dates[1]) {
              setTimeRangeValue(
                `${dates[0].format('YYYY-MM-DD')}${SEPARATOR}${dates[1].format('YYYY-MM-DD')}`,
              );
            } else {
              setTimeRangeValue(NO_TIME_RANGE);
            }
          }}
          allowClear={false}
          getPopupContainer={() =>
            calendarContainerRef.current ?? document.body
          }
        />
      </InlineCalendarContainer>


      {/* Start / End text inputs with formula hints */}
      <div style={{ display: 'flex', gap: 16, boxSizing: 'border-box' }}>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="control-label">
            {t('Start (inclusive)')}{' '}
            <InfoTooltip
              tooltip={t('Start date included in time range')}
              placement="right"
            />
          </div>
          <InputWrapper>
            <input
              className="ant-input"
              value={since}
              onChange={e =>
                setTimeRangeValue(`${e.target.value}${SEPARATOR}${until}`)
              }
              placeholder={t('Select in calendar or type')}
              style={{ width: '100%', boxSizing: 'border-box', paddingRight: 30 }}
            />
            {since && (
              <span
                className="clear-icon"
                onClick={() => setTimeRangeValue(`${SEPARATOR}${until}`)}
              >
                ✕
              </span>
            )}
          </InputWrapper>
          <div style={{ marginTop: 2, fontSize: 11, opacity: 0.6 }}>
            {t('Suggested:')}{' '}
            <a
              style={{ color: '#00a86b' }}
              onClick={() => setTimeRangeValue(`7 days ago${SEPARATOR}${until}`)}
            >
              {t('7 days ago')}
            </a>
            {', '}
            <a
              style={{ color: '#00a86b' }}
              onClick={() => setTimeRangeValue(`30 days ago${SEPARATOR}${until}`)}
            >
              {t('30 days ago')}
            </a>
          </div>
        </div>


        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <div className="control-label">
            {t('End (exclusive)')}{' '}
            <InfoTooltip
              tooltip={t('End date excluded from time range')}
              placement="right"
            />
          </div>
          <InputWrapper>
            <input
              className="ant-input"
              value={until}
              onChange={e =>
                setTimeRangeValue(`${since}${SEPARATOR}${e.target.value}`)
              }
              placeholder={t('Select in calendar or type')}
              style={{ width: '100%', boxSizing: 'border-box', paddingRight: 30 }}
            />
            {until && (
              <span
                className="clear-icon"
                onClick={() => setTimeRangeValue(`${since}${SEPARATOR}`)}
              >
                ✕
              </span>
            )}
          </InputWrapper>
          <div style={{ marginTop: 2, fontSize: 11, opacity: 0.6 }}>
            {t('Suggested:')}{' '}
            <a
              style={{ color: '#00a86b' }}
              onClick={() => setTimeRangeValue(`${since}${SEPARATOR}now`)}
            >
              {t('now')}
            </a>
            {', '}
            <a
              style={{ color: '#00a86b' }}
              onClick={() => setTimeRangeValue(`${since}${SEPARATOR}yesterday`)}
            >
              {t('yesterday')}
            </a>
          </div>
        </div>
      </div>
    </AntdThemeProvider>
  );


  const renderTabContent = () => {
    switch (activeTab) {
      case 'last': return <CommonFrame {...frameProps} />;
      case 'previous': return <CalendarFrame {...frameProps} />;
      case 'current': return <CurrentCalendarFrame {...frameProps} />;
      case 'custom': return <CustomFrame {...frameProps} />;
      default: return renderBasicTab();
    }
  };


  /* ---------------------------------------------------------------- */
  /*  Popover overlay                                                   */
  /* ---------------------------------------------------------------- */
  const overlayContent = (
    <PopoverContent>
      <div className="tab-nav">
        {TAB_CONFIG.map(({ key, label }) => (
          <div
            key={key}
            className={`tab-nav-item${activeTab === key ? ' active' : ''}`}
            onClick={() => onTabChange(key)}
          >
            {t(label)}
          </div>
        ))}
      </div>


      <div className="tab-body">{renderTabContent()}</div>


      <Divider />


      <div style={{ padding: '0 16px' }}>
        <ActualTimeRange title={evalResponse}>
          <span className="label">{t('Actual range')}:</span>
          {isRangeDynamic && <StatusTag>{t('Dynamic')}</StatusTag>}
          <span>{evalResponse || t('Select a range...')}</span>
        </ActualTimeRange>
      </div>


      <Divider style={{ margin: '8px 0' }} />


      <div
        style={{
          padding: '0 16px 10px',
          textAlign: 'right',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
        }}
      >
        <Button
          buttonStyle="secondary"
          cta
          key="cancel"
          onClick={onClose}
          size="small"
          style={{ minWidth: '80px' }}
          data-test={DateFilterTestKey.CancelButton}
        >
          {t('Cancel')}
        </Button>
        <Button
          buttonStyle="primary"
          cta
          key="apply"
          onClick={onApply}
          disabled={!validTimeRange}
          size="small"
          style={{ minWidth: '80px' }}
          data-test={DateFilterTestKey.ApplyButton}
        >
          {t('Apply')}
        </Button>
      </div>
    </PopoverContent>
  );


  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */
  return props.formData?.inView ? (
    <DateTimeFilterStyles width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        tabIndex={-1}
      >
        <ControlPopover
          trigger="click"
          open={show}
          onOpenChange={openState => {
            if (openState) onOpen();
            else onClose();
          }}
          content={overlayContent}
          overlayStyle={{ width: '620px' }}
          align={{
            overflow: { adjustY: true, shiftY: true },
          }}
          destroyTooltipOnHide
          getPopupContainer={nodeTrigger =>
            isOverflowingFilterBar
              ? (nodeTrigger.parentNode as HTMLElement)
              : document.body
          }
        >
          {/* Decorative RangePicker trigger — click captured by overlay div */}
          <div style={{ position: 'relative', width: '100%' }}>
            <AntdThemeProvider locale={datePickerLocale ?? undefined}>
              <RangePicker
                value={triggerDates}
                open={false}
                allowClear={false}
                style={{ width: '100%', pointerEvents: 'none' }}
                placeholder={[t('Start date'), t('End date')]}
                separator="→"
                inputReadOnly
              />
            </AntdThemeProvider>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                cursor: 'pointer',
                zIndex: 1,
              }}
            />
          </div>
        </ControlPopover>
      </ControlContainer>
    </DateTimeFilterStyles>
  ) : null;
}
