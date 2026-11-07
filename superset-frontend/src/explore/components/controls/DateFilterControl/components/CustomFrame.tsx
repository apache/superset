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
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { customTimeRangeDecode } from '@superset-ui/core';
import {
  InfoTooltip,
  DatePicker,
  Select,
  Radio,
  AntdThemeProvider,
  Col,
  Row,
  InputNumber,
  Loading,
} from '@superset-ui/core/components';
import {
  SINCE_GRAIN_OPTIONS,
  SINCE_MODE_OPTIONS,
  UNTIL_GRAIN_OPTIONS,
  UNTIL_MODE_OPTIONS,
  DAYJS_FORMAT,
  MIDNIGHT,
  customTimeRangeEncode,
  dttmToDayjs,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CustomRangeKey,
  FieldError,
  FrameComponentProps,
  FrameLimits,
} from 'src/explore/components/controls/DateFilterControl/types';
import { Dayjs } from 'dayjs';
import { useLocale } from 'src/hooks/useLocale';
import { fieldAria, fieldSlot } from './limitFields';

type Calendar = 'start' | 'end' | 'anchor';

// rc-picker's default text for a showTime picker; CustomFrame passes no format.
const PICKER_FORMAT = 'YYYY-MM-DD HH:mm:ss';

type SpecificPickerProps = {
  control: 'sinceDatetime' | 'untilDatetime';
  datetime: string;
  onChange: (control: CustomRangeKey, value: string) => void;
  limits: FrameLimits | undefined;
  error: FieldError | undefined;
  disabledDate: ((current: Dayjs) => boolean) | undefined;
  ariaLabel: string;
  calendarProps: { onOpenChange?: (open: boolean) => void };
};

function SpecificPicker({
  control,
  datetime,
  onChange,
  limits,
  error,
  disabledDate,
  ariaLabel,
  calendarProps,
}: SpecificPickerProps) {
  const value = useMemo(() => dttmToDayjs(datetime), [datetime]);
  const typedDate = useRef<Dayjs | null>(null);
  const edited = useRef(false);
  // rc-picker drops a typed date its disabledDate rejects; with limits on it
  // is committed on blur or Enter, so its error shows.
  const commitTyped = () => {
    const typed = typedDate.current;
    typedDate.current = null;
    if (typed && disabledDate?.(typed) && !typed.isSame(value)) {
      onChange(control, typed.format(DAYJS_FORMAT));
    }
  };
  const valueProps = limits
    ? {
        value,
        onCalendarChange: (date: Dayjs | Dayjs[] | null) => {
          // Escape and closing the calendar reset it to the stored date
          // before the blur; only a reset typed in the input drops the date.
          const reset = !Array.isArray(date) && !!date?.isSame(value);
          if (reset && !edited.current) {
            return;
          }
          edited.current = false;
          typedDate.current = Array.isArray(date) ? null : date;
        },
        onFocus: () => {
          typedDate.current = null;
        },
        onBlur: commitTyped,
        onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
          edited.current =
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            (event.key.length === 1 ||
              event.key === 'Backspace' ||
              event.key === 'Delete');
          if (event.key === 'Enter') {
            if (
              typedDate.current?.format(PICKER_FORMAT) !==
              event.currentTarget.value
            ) {
              typedDate.current = null;
            }
            commitTyped();
          }
        },
      }
    : { defaultValue: value };
  return (
    <DatePicker
      showTime
      onChange={(date: Dayjs) => onChange(control, date.format(DAYJS_FORMAT))}
      allowClear={false}
      getPopupContainer={() => document.body}
      disabledDate={disabledDate}
      aria-label={limits ? ariaLabel : undefined}
      {...valueProps}
      {...calendarProps}
      {...fieldAria(limits, error)}
      {...(limits && {
        'aria-invalid': !limits.pending && (!!error || !!limits.rowInvalid),
      })}
    />
  );
}

export function CustomFrame(props: FrameComponentProps) {
  const { limits } = props;
  const { customRange, matchedFlag } = customTimeRangeDecode(props.value);
  const datePickerLocale = useLocale();
  const [openCalendars, setOpenCalendars] = useState<
    Partial<Record<Calendar, boolean>>
  >({});
  const calendarOpen = Object.values(openCalendars).some(Boolean);
  const onCalendarOpenChange = limits?.onCalendarOpenChange;
  useEffect(() => {
    onCalendarOpenChange?.(calendarOpen);
    return () => onCalendarOpenChange?.(false);
  }, [calendarOpen, onCalendarOpenChange]);
  const calendarProps = (calendar: Calendar) =>
    limits
      ? {
          onOpenChange: (open: boolean) =>
            setOpenCalendars(previous => ({ ...previous, [calendar]: open })),
        }
      : {};
  if (!matchedFlag) {
    props.onChange(customTimeRangeEncode(customRange));
  }
  const {
    sinceDatetime,
    sinceMode,
    sinceGrain,
    sinceGrainValue,
    untilDatetime,
    untilMode,
    untilGrain,
    untilGrainValue,
    anchorValue,
    anchorMode,
  } = { ...customRange };

  function onChange(control: CustomRangeKey, value: string) {
    props.onChange(
      customTimeRangeEncode({
        ...customRange,
        [control]: value,
      }),
    );
  }

  function onGrainValue(
    control: 'sinceGrainValue' | 'untilGrainValue',
    value: string | number,
  ) {
    // only positive values in grainValue controls
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      props.onChange(
        customTimeRangeEncode({
          ...customRange,
          [control]: value,
        }),
      );
    }
  }

  function onAnchorMode(option: any) {
    const radioValue = option.target.value;
    if (radioValue === 'now') {
      props.onChange(
        customTimeRangeEncode({
          ...customRange,
          anchorValue: 'now',
          anchorMode: radioValue,
        }),
      );
    } else {
      props.onChange(
        customTimeRangeEncode({
          ...customRange,
          anchorValue: MIDNIGHT,
          anchorMode: radioValue,
        }),
      );
    }
  }

  if (datePickerLocale === null) {
    return <Loading position="inline-centered" />;
  }

  return (
    <AntdThemeProvider locale={datePickerLocale}>
      <div data-test="custom-frame">
        <div className="section-title">{t('Configure custom time range')}</div>
        <Row gutter={24}>
          <Col span={12}>
            <div className="control-label">
              {t('Start (inclusive)')}{' '}
              <InfoTooltip
                tooltip={t('Start date included in time range')}
                placement="right"
              />
            </div>
            {fieldSlot(
              limits,
              limits?.start,
              <>
                <Select
                  ariaLabel={t('Start (inclusive)')}
                  options={SINCE_MODE_OPTIONS}
                  value={sinceMode}
                  onChange={(value: string) => onChange('sinceMode', value)}
                  name={limits?.startId}
                  {...fieldAria(limits, limits?.start)}
                />
                {sinceMode === 'specific' && (
                  <Row>
                    <SpecificPicker
                      control="sinceDatetime"
                      datetime={sinceDatetime}
                      onChange={onChange}
                      limits={limits}
                      error={limits?.start}
                      disabledDate={limits?.disabledStartDate}
                      ariaLabel={t('Start (inclusive)')}
                      calendarProps={calendarProps('start')}
                    />
                  </Row>
                )}
                {sinceMode === 'relative' && (
                  <Row gutter={8}>
                    <Col span={11}>
                      {/* Make sure sinceGrainValue looks like a positive integer */}
                      <InputNumber
                        placeholder={t('Relative quantity')}
                        aria-label={limits ? t('Relative quantity') : undefined}
                        value={Math.abs(sinceGrainValue)}
                        min={1}
                        defaultValue={1}
                        onChange={value =>
                          onGrainValue('sinceGrainValue', value || 1)
                        }
                        onStep={value =>
                          onGrainValue('sinceGrainValue', value || 1)
                        }
                      />
                    </Col>
                    <Col span={13}>
                      <Select
                        ariaLabel={t('Relative period')}
                        options={SINCE_GRAIN_OPTIONS}
                        value={sinceGrain}
                        onChange={(value: string) =>
                          onChange('sinceGrain', value)
                        }
                      />
                    </Col>
                  </Row>
                )}
              </>,
            )}
          </Col>
          <Col span={12}>
            <div className="control-label">
              {t('End (exclusive)')}{' '}
              <InfoTooltip
                tooltip={t('End date excluded from time range')}
                placement="right"
              />
            </div>
            {fieldSlot(
              limits,
              limits?.end,
              <>
                <Select
                  ariaLabel={t('End (exclusive)')}
                  options={UNTIL_MODE_OPTIONS}
                  value={untilMode}
                  onChange={(value: string) => onChange('untilMode', value)}
                  name={limits?.endId}
                  {...fieldAria(limits, limits?.end)}
                />
                {untilMode === 'specific' && (
                  <Row>
                    <SpecificPicker
                      control="untilDatetime"
                      datetime={untilDatetime}
                      onChange={onChange}
                      limits={limits}
                      error={limits?.end}
                      disabledDate={limits?.disabledEndDate}
                      ariaLabel={t('End (exclusive)')}
                      calendarProps={calendarProps('end')}
                    />
                  </Row>
                )}
                {untilMode === 'relative' && (
                  <Row gutter={8}>
                    <Col span={11}>
                      <InputNumber
                        placeholder={t('Relative quantity')}
                        aria-label={limits ? t('Relative quantity') : undefined}
                        value={untilGrainValue}
                        min={1}
                        defaultValue={1}
                        onChange={value =>
                          onGrainValue('untilGrainValue', value || 1)
                        }
                        onStep={value =>
                          onGrainValue('untilGrainValue', value || 1)
                        }
                      />
                    </Col>
                    <Col span={13}>
                      <Select
                        ariaLabel={t('Relative period')}
                        options={UNTIL_GRAIN_OPTIONS}
                        value={untilGrain}
                        onChange={(value: string) =>
                          onChange('untilGrain', value)
                        }
                      />
                    </Col>
                  </Row>
                )}
              </>,
            )}
          </Col>
        </Row>
        {sinceMode === 'relative' && untilMode === 'relative' && (
          <div className="control-anchor-to">
            <div className="control-label">{t('Anchor to')}</div>
            <Row align="middle">
              <Col>
                <Radio.GroupWrapper
                  options={[
                    { value: 'now', label: t('Now') },
                    { value: 'specific', label: t('Date/Time') },
                  ]}
                  onChange={onAnchorMode}
                  defaultValue="now"
                  value={anchorMode}
                />
              </Col>
              {anchorMode !== 'now' && (
                <Col>
                  <DatePicker
                    showTime
                    defaultValue={dttmToDayjs(anchorValue)}
                    onChange={(datetime: Dayjs) =>
                      onChange('anchorValue', datetime.format(DAYJS_FORMAT))
                    }
                    allowClear={false}
                    className="control-anchor-to-datetime"
                    aria-label={limits ? t('Anchor to') : undefined}
                    {...calendarProps('anchor')}
                    getPopupContainer={() => document.body}
                  />
                </Col>
              )}
            </Row>
          </div>
        )}
      </div>
    </AntdThemeProvider>
  );
}
