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
import React, { useState, useEffect } from 'react';
import rison from 'rison';
import moment, { Moment } from 'moment';
import {
  SupersetClient,
  styled,
  supersetTheme,
  t,
  TimeRangeEndpoints,
} from '@superset-ui/core';
import {
  buildTimeRangeString,
  formatTimeRange,
  SEPARATOR,
} from 'src/explore/dateFilterUtils';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import Button from 'src/components/Button';
import ControlHeader from 'src/explore/components/ControlHeader';
import Label from 'src/components/Label';
import Modal from 'src/common/components/Modal';
import {
  Col,
  DatePicker,
  Divider,
  Input,
  InputNumber,
  Radio,
  Row,
} from 'src/common/components';
import Icon from 'src/components/Icon';
import { Select } from 'src/components/Select';
import {
  TimeRangeFrameType,
  CommonRangeType,
  CalendarRangeType,
  CustomRangeType,
  CustomRangeDecodeType,
  CustomRangeKey,
  PreviousCalendarWeek,
  PreviousCalendarMonth,
  PreviousCalendarYear,
} from './types';
import {
  COMMON_RANGE_OPTIONS,
  CALENDAR_RANGE_OPTIONS,
  RANGE_FRAME_OPTIONS,
  SINCE_GRAIN_OPTIONS,
  UNTIL_GRAIN_OPTIONS,
  SINCE_MODE_OPTIONS,
  UNTIL_MODE_OPTIONS,
} from './constants';

const MOMENT_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
const DEFAULT_SINCE = moment()
  .utc()
  .startOf('day')
  .subtract(7, 'days')
  .format(MOMENT_FORMAT);
const DEFAULT_UNTIL = moment().utc().startOf('day').format(MOMENT_FORMAT);

/**
 * RegExp to test a string for a full ISO 8601 Date
 * Does not do any sort of date validation, only checks if the string is according to the ISO 8601 spec.
 *  YYYY-MM-DDThh:mm:ss
 *  YYYY-MM-DDThh:mm:ssTZD
 *  YYYY-MM-DDThh:mm:ss.sTZD
 * @see: https://www.w3.org/TR/NOTE-datetime
 */
const iso8601 = String.raw`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:(?:[+-]\d\d:\d\d)|Z)?`;
const datetimeConstant = String.raw`TODAY|NOW`;
const grainValue = String.raw`[+-]?[1-9][0-9]*`;
const grain = String.raw`YEAR|QUARTER|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND`;
const CUSTOM_RANGE_EXPRESSION = RegExp(
  String.raw`^DATEADD\(DATETIME\("(${iso8601}|${datetimeConstant})"\),\s(${grainValue}),\s(${grain})\)$`,
  'i',
);
export const ISO8601_AND_CONSTANT = RegExp(
  String.raw`^${iso8601}$|^${datetimeConstant}$`,
  'i',
);

const DATETIME_CONSTANT = ['now', 'today'];
const defaultCustomRange: CustomRangeType = {
  sinceDatetime: DEFAULT_SINCE,
  sinceMode: 'relative',
  sinceGrain: 'day',
  sinceGrainValue: -7,
  untilDatetime: DEFAULT_UNTIL,
  untilMode: 'specific',
  untilGrain: 'day',
  untilGrainValue: 7,
  anchorMode: 'now',
  anchorValue: 'now',
};
const SPECIFIC_MODE = ['specific', 'today', 'now'];

const COMMON_RANGE_OPTIONS_SET = new Set(
  COMMON_RANGE_OPTIONS.map(({ value }) => value),
);
const CALENDAR_RANGE_OPTIONS_SET = new Set(
  CALENDAR_RANGE_OPTIONS.map(({ value }) => value),
);

const commonRangeSet: Set<CommonRangeType> = new Set([
  'Last day',
  'Last week',
  'Last month',
  'Last quarter',
  'Last year',
]);
const CalendarRangeSet: Set<CalendarRangeType> = new Set([
  PreviousCalendarWeek,
  PreviousCalendarMonth,
  PreviousCalendarYear,
]);

const customTimeRangeDecode = (timeRange: string): CustomRangeDecodeType => {
  const splitDateRange = timeRange.split(SEPARATOR);

  if (splitDateRange.length === 2) {
    const [since, until] = splitDateRange;

    // specific : specific
    if (ISO8601_AND_CONSTANT.test(since) && ISO8601_AND_CONSTANT.test(until)) {
      const sinceMode = DATETIME_CONSTANT.includes(since) ? since : 'specific';
      const untilMode = DATETIME_CONSTANT.includes(until) ? until : 'specific';
      return {
        customRange: {
          ...defaultCustomRange,
          sinceDatetime: since,
          untilDatetime: until,
          sinceMode,
          untilMode,
        },
        matchedFlag: true,
      };
    }

    // relative : specific
    const sinceCapturedGroup = since.match(CUSTOM_RANGE_EXPRESSION);
    if (
      sinceCapturedGroup &&
      ISO8601_AND_CONSTANT.test(until) &&
      since.includes(until)
    ) {
      const [dttm, grainValue, grain] = sinceCapturedGroup.slice(1);
      const untilMode = DATETIME_CONSTANT.includes(until) ? until : 'specific';
      return {
        customRange: {
          ...defaultCustomRange,
          sinceGrain: grain,
          sinceGrainValue: parseInt(grainValue, 10),
          untilDatetime: dttm,
          sinceMode: 'relative',
          untilMode,
        },
        matchedFlag: true,
      };
    }

    // specific : relative
    const untilCapturedGroup = until.match(CUSTOM_RANGE_EXPRESSION);
    if (
      ISO8601_AND_CONSTANT.test(since) &&
      untilCapturedGroup &&
      until.includes(since)
    ) {
      const [dttm, grainValue, grain] = [...untilCapturedGroup.slice(1)];
      const sinceMode = DATETIME_CONSTANT.includes(since) ? since : 'specific';
      return {
        customRange: {
          ...defaultCustomRange,
          untilGrain: grain,
          untilGrainValue: parseInt(grainValue, 10),
          sinceDatetime: dttm,
          untilMode: 'relative',
          sinceMode,
        },
        matchedFlag: true,
      };
    }

    // relative : relative
    if (sinceCapturedGroup && untilCapturedGroup) {
      const [sinceDttm, sinceGrainValue, sinceGrain] = [
        ...sinceCapturedGroup.slice(1),
      ];
      const [untileDttm, untilGrainValue, untilGrain] = [
        ...untilCapturedGroup.slice(1),
      ];
      if (sinceDttm === untileDttm) {
        return {
          customRange: {
            ...defaultCustomRange,
            sinceGrain,
            sinceGrainValue: parseInt(sinceGrainValue, 10),
            untilGrain,
            untilGrainValue: parseInt(untilGrainValue, 10),
            anchorValue: sinceDttm,
            sinceMode: 'relative',
            untilMode: 'relative',
            anchorMode: sinceDttm === 'now' ? 'now' : 'specific',
          },
          matchedFlag: true,
        };
      }
    }
  }

  return {
    customRange: defaultCustomRange,
    matchedFlag: false,
  };
};

const customTimeRangeEncode = (customRange: CustomRangeType): string => {
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
  } = { ...customRange };
  // specific : specific
  if (SPECIFIC_MODE.includes(sinceMode) && SPECIFIC_MODE.includes(untilMode)) {
    const since = sinceMode === 'specific' ? sinceDatetime : sinceMode;
    const until = untilMode === 'specific' ? untilDatetime : untilMode;
    return `${since} : ${until}`;
  }

  // specific : relative
  if (SPECIFIC_MODE.includes(sinceMode) && untilMode === 'relative') {
    const since = sinceMode === 'specific' ? sinceDatetime : sinceMode;
    const until = `DATEADD(DATETIME("${since}"), ${untilGrainValue}, ${untilGrain})`;
    return `${since} : ${until}`;
  }

  // relative : specific
  if (sinceMode === 'relative' && SPECIFIC_MODE.includes(untilMode)) {
    const until = untilMode === 'specific' ? untilDatetime : untilMode;
    const since = `DATEADD(DATETIME("${until}"), ${-Math.abs(sinceGrainValue)}, ${sinceGrain})`;  // eslint-disable-line
    return `${since} : ${until}`;
  }

  // relative : relative
  const since = `DATEADD(DATETIME("${anchorValue}"), ${-Math.abs(sinceGrainValue)}, ${sinceGrain})`;  // eslint-disable-line
  const until = `DATEADD(DATETIME("${anchorValue}"), ${untilGrainValue}, ${untilGrain})`;
  return `${since} : ${until}`;
};

const guessTimeRangeFrame = (timeRange: string): TimeRangeFrameType => {
  if (COMMON_RANGE_OPTIONS_SET.has(timeRange)) {
    return 'Common';
  }
  if (CALENDAR_RANGE_OPTIONS_SET.has(timeRange)) {
    return 'Calendar';
  }
  if (timeRange === 'No filter') {
    return 'No Filter';
  }
  if (customTimeRangeDecode(timeRange).matchedFlag) {
    return 'Custom';
  }
  return 'Advanced';
};

const dttmToMoment = (dttm: string): Moment => {
  if (dttm === 'now') {
    return moment().utc().startOf('second');
  }
  if (dttm === 'today') {
    return moment().utc().startOf('day');
  }
  return moment(dttm);
};

const fetchTimeRange = async (
  timeRange: string,
  endpoints?: TimeRangeEndpoints,
) => {
  const query = rison.encode(timeRange);
  const endpoint = `/api/v1/time_range/?q=${query}`;

  try {
    const response = await SupersetClient.get({ endpoint });
    const timeRangeString = buildTimeRangeString(
      response?.json?.result?.since || '',
      response?.json?.result?.until || '',
    );
    return {
      value: formatTimeRange(timeRangeString, endpoints),
    };
  } catch (response) {
    const clientError = await getClientErrorObject(response);
    return {
      error: clientError.message || clientError.error,
    };
  }
};

const StyledModalContainer = styled.div`
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
    font-weight: 500;
    color: #b2b2b2;
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
    font-weight: 500;
    font-size: 15px;
    line-height: 24px;
    margin-bottom: 8px;
  }
`;

const StyledValidateBtn = styled.span`
  .validate-btn {
    float: left;
  }
`;

const IconWrapper = styled.span`
  svg {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
    vertical-align: middle;
    display: inline-block;
  }
  .text {
    vertical-align: middle;
    display: inline-block;
  }
  .error {
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

interface DateFilterLabelProps {
  name: string;
  onChange: (timeRange: string) => void;
  value?: string;
  endpoints?: TimeRangeEndpoints;
}

export default function DateFilterControl(props: DateFilterLabelProps) {
  const { value = 'Last week', endpoints, onChange } = props;
  const [actualTimeRange, setActualTimeRange] = useState<string>(value);

  // State used for Modal
  const [show, setShow] = useState<boolean>(false);
  const [timeRangeFrame, setTimeRangeFrame] = useState<TimeRangeFrameType>(
    guessTimeRangeFrame(value),
  );
  const [commonRange, setCommonRange] = useState<CommonRangeType>(
    getDefaultOrCommonRange(value),
  );
  const [calendarRange, setCalendarRange] = useState<CalendarRangeType>(
    getDefaultOrCalendarRange(value),
  );
  const [customRange, setCustomRange] = useState<CustomRangeType>(
    customTimeRangeDecode(value).customRange,
  );
  const [advancedRange, setAdvancedRange] = useState<string>(
    getAdvancedRange(value),
  );
  const [validTimeRange, setValidTimeRange] = useState<boolean>(false);
  const [evalTimeRange, setEvalTimeRange] = useState<string>(value);

  useEffect(() => {
    fetchTimeRange(value, endpoints).then(({ value, error }) => {
      if (error) {
        setEvalTimeRange(error || '');
        setValidTimeRange(false);
      } else {
        setActualTimeRange(value || '');
        setValidTimeRange(true);
      }
    });
  }, [value]);

  useEffect(() => {
    const value = getCurrentValue();
    fetchTimeRange(value, endpoints).then(({ value, error }) => {
      if (error) {
        setEvalTimeRange(error || '');
        setValidTimeRange(false);
      } else {
        setEvalTimeRange(value || '');
        setValidTimeRange(true);
      }
    });
  }, [timeRangeFrame, commonRange, calendarRange, customRange]);

  function getCurrentValue(): string {
    // get current time_range string
    let value = 'Last week';
    if (timeRangeFrame === 'Common') {
      value = commonRange;
    }
    if (timeRangeFrame === 'Calendar') {
      value = calendarRange;
    }
    if (timeRangeFrame === 'Custom') {
      value = customTimeRangeEncode(customRange);
    }
    if (timeRangeFrame === 'Advanced') {
      value = advancedRange;
    }
    if (timeRangeFrame === 'No Filter') {
      value = 'No filter';
    }
    return value;
  }

  function getDefaultOrCommonRange(value: any): CommonRangeType {
    return commonRangeSet.has(value) ? value : 'Last week';
  }

  function getDefaultOrCalendarRange(value: any): CalendarRangeType {
    return CalendarRangeSet.has(value) ? value : PreviousCalendarWeek;
  }

  function getAdvancedRange(value: string): string {
    if (value.includes(SEPARATOR)) {
      return value;
    }
    if (value.startsWith('Last')) {
      return [value, ''].join(SEPARATOR);
    }
    if (value.startsWith('Next')) {
      return ['', value].join(SEPARATOR);
    }
    return SEPARATOR;
  }

  function onAdvancedRangeChange(control: 'since' | 'until', value: string) {
    setValidTimeRange(false);
    setEvalTimeRange(t('Need to verify the time range.'));
    const [since, until] = advancedRange.split(SEPARATOR);
    if (control === 'since') {
      setAdvancedRange(`${value}${SEPARATOR}${until}`);
    } else {
      setAdvancedRange(`${since}${SEPARATOR}${value}`);
    }
  }

  function onCustomRangeChange(
    control: CustomRangeKey,
    value: string | number,
  ) {
    setCustomRange({
      ...customRange,
      [control]: value,
    });
  }

  function onCustomRangeChangeAnchorMode(option: any) {
    const radioValue = option.target.value;
    if (radioValue === 'now') {
      setCustomRange({
        ...customRange,
        anchorValue: 'now',
        anchorMode: radioValue,
      });
    } else {
      setCustomRange({
        ...customRange,
        anchorValue: DEFAULT_UNTIL,
        anchorMode: radioValue,
      });
    }
  }

  function showValidateBtn(): boolean {
    return timeRangeFrame === 'Advanced';
  }

  function resetState(value: string) {
    setTimeRangeFrame(guessTimeRangeFrame(value));
    setCommonRange(getDefaultOrCommonRange(value));
    setCalendarRange(getDefaultOrCalendarRange(value));
    setCustomRange(customTimeRangeDecode(value).customRange);
    setAdvancedRange(getAdvancedRange(value));
    setShow(false);
  }

  function onSave() {
    const currentValue = getCurrentValue();
    onChange(currentValue);
    resetState(currentValue);
  }

  function onHide() {
    resetState(value);
  }

  function onValidate() {
    const value = getCurrentValue();
    fetchTimeRange(value, endpoints).then(({ value, error }) => {
      if (error) {
        setEvalTimeRange(error || '');
        setValidTimeRange(false);
      } else {
        setEvalTimeRange(value || '');
        setValidTimeRange(true);
      }
    });
  }

  function renderCommon() {
    const commonRangeValue =
      COMMON_RANGE_OPTIONS.find(({ value }) => value === commonRange)?.value ||
      'Last week';
    return (
      <>
        <div className="section-title">
          {t('Configure Time Range: Last...')}
        </div>
        <Radio.Group
          value={commonRangeValue}
          onChange={(e: any) => setCommonRange(e.target.value)}
        >
          {COMMON_RANGE_OPTIONS.map(({ value, label }) => (
            <Radio key={value} value={value} className="vertical-radio">
              {label}
            </Radio>
          ))}
        </Radio.Group>
      </>
    );
  }

  function renderCalendar() {
    const currentValue =
      CALENDAR_RANGE_OPTIONS.find(({ value }) => value === calendarRange)
        ?.value || PreviousCalendarWeek;
    return (
      <>
        <div className="section-title">
          {t('Configure Time Range: Previous...')}
        </div>
        <Radio.Group
          value={currentValue}
          onChange={(e: any) => setCalendarRange(e.target.value)}
        >
          {CALENDAR_RANGE_OPTIONS.map(({ value, label }) => (
            <Radio key={value} value={value} className="vertical-radio">
              {label}
            </Radio>
          ))}
        </Radio.Group>
      </>
    );
  }

  function renderAdvanced() {
    const [since, until] = advancedRange.split(SEPARATOR);
    return (
      <>
        <div className="section-title">
          {t('Configure Advanced Time Range')}
        </div>
        <div className="control-label">{t('START')}</div>
        <Input
          key="since"
          value={since}
          onChange={e => onAdvancedRangeChange('since', e.target.value)}
        />
        <div className="control-label">{t('END')}</div>
        <Input
          key="until"
          value={until}
          onChange={e => onAdvancedRangeChange('until', e.target.value)}
        />
      </>
    );
  }

  function renderCustom() {
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

    return (
      <>
        <div className="section-title">{t('Configure Custom Time Range')}</div>
        <Row gutter={8}>
          <Col span={12}>
            <div className="control-label">{t('START')}</div>
            <Select
              options={SINCE_MODE_OPTIONS}
              value={SINCE_MODE_OPTIONS.filter(
                option => option.value === sinceMode,
              )}
              onChange={(option: any) =>
                onCustomRangeChange('sinceMode', option.value)
              }
            />
            {sinceMode === 'specific' && (
              <Row>
                <DatePicker
                  showTime
                  value={dttmToMoment(sinceDatetime)}
                  onChange={(datetime: Moment) =>
                    onCustomRangeChange(
                      'sinceDatetime',
                      datetime.format(MOMENT_FORMAT),
                    )
                  }
                  allowClear={false}
                />
              </Row>
            )}
            {sinceMode === 'relative' && (
              <Row gutter={8}>
                <Col span={10}>
                  {/* Make sure sinceGrainValue looks like a positive integer */}
                  <InputNumber
                    placeholder={t('Relative quantity')}
                    value={Math.abs(sinceGrainValue)}
                    min={1}
                    defaultValue={1}
                    onStep={value =>
                      onCustomRangeChange('sinceGrainValue', value || 1)
                    }
                  />
                </Col>
                <Col span={14}>
                  <Select
                    options={SINCE_GRAIN_OPTIONS}
                    value={SINCE_GRAIN_OPTIONS.filter(
                      option => option.value === sinceGrain,
                    )}
                    onChange={(option: any) =>
                      onCustomRangeChange('sinceGrain', option.value)
                    }
                  />
                </Col>
              </Row>
            )}
          </Col>
          <Col span={12}>
            <div className="control-label">{t('END')}</div>
            <Select
              options={UNTIL_MODE_OPTIONS}
              value={UNTIL_MODE_OPTIONS.filter(
                option => option.value === untilMode,
              )}
              onChange={(option: any) =>
                onCustomRangeChange('untilMode', option.value)
              }
            />
            {untilMode === 'specific' && (
              <Row>
                <DatePicker
                  showTime
                  value={dttmToMoment(untilDatetime)}
                  onChange={(datetime: Moment) =>
                    onCustomRangeChange(
                      'untilDatetime',
                      datetime.format(MOMENT_FORMAT),
                    )
                  }
                  allowClear={false}
                />
              </Row>
            )}
            {untilMode === 'relative' && (
              <Row gutter={8}>
                <Col span={10}>
                  <InputNumber
                    placeholder={t('Relative quantity')}
                    value={untilGrainValue}
                    min={1}
                    defaultValue={1}
                    onStep={value =>
                      onCustomRangeChange('untilGrainValue', value || 1)
                    }
                  />
                </Col>
                <Col span={14}>
                  <Select
                    options={UNTIL_GRAIN_OPTIONS}
                    value={UNTIL_GRAIN_OPTIONS.filter(
                      option => option.value === untilGrain,
                    )}
                    onChange={(option: any) =>
                      onCustomRangeChange('untilGrain', option.value)
                    }
                  />
                </Col>
              </Row>
            )}
          </Col>
        </Row>
        {sinceMode === 'relative' && untilMode === 'relative' && (
          <>
            <div className="control-label">{t('ANCHOR RELATIVE TO')}</div>
            <Row align="middle">
              <Col>
                <Radio.Group
                  onChange={onCustomRangeChangeAnchorMode}
                  defaultValue="now"
                  value={anchorMode}
                >
                  <Radio key="now" value="now">
                    {t('NOW')}
                  </Radio>
                  <Radio key="specific" value="specific">
                    {t('Date/Time')}
                  </Radio>
                </Radio.Group>
              </Col>
              {anchorMode !== 'now' && (
                <Col>
                  <DatePicker
                    showTime
                    value={dttmToMoment(anchorValue)}
                    onChange={(datetime: Moment) =>
                      onCustomRangeChange(
                        'anchorValue',
                        datetime.format(MOMENT_FORMAT),
                      )
                    }
                    allowClear={false}
                  />
                </Col>
              )}
            </Row>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <ControlHeader {...props} />
      <Label
        className="pointer"
        data-test="time-range-trigger"
        onClick={() => setShow(true)}
      >
        {actualTimeRange}
      </Label>
      <Modal
        name="time-range" // data-test=time-range-modal
        title={
          <IconWrapper>
            <Icon name="edit-alt" />
            <span className="text">{t('Edit Time Range')}</span>
          </IconWrapper>
        }
        show={show}
        onHide={onHide}
        footer={[
          <Button
            buttonStyle="secondary"
            cta
            key="cancel"
            onClick={onHide}
            data-test="modal-cancel-button"
          >
            {t('CANCEL')}
          </Button>,
          <Button
            buttonStyle="primary"
            cta
            disabled={!validTimeRange}
            key="apply"
            onClick={onSave}
          >
            {t('APPLY')}
          </Button>,
          showValidateBtn() && (
            <StyledValidateBtn key="validate">
              <Button
                buttonStyle="tertiary"
                cta
                className="validate-btn"
                onClick={onValidate}
              >
                {t('Validate')}
              </Button>
            </StyledValidateBtn>
          ),
        ]}
      >
        <StyledModalContainer>
          <div className="control-label">{t('RANGE TYPE')}</div>
          <Select
            options={RANGE_FRAME_OPTIONS}
            value={RANGE_FRAME_OPTIONS.filter(
              ({ value }) => value === timeRangeFrame,
            )}
            onChange={(_: any) => setTimeRangeFrame(_.value)}
          />
          {timeRangeFrame !== 'No Filter' && <Divider />}
          {timeRangeFrame === 'Common' && renderCommon()}
          {timeRangeFrame === 'Calendar' && renderCalendar()}
          {timeRangeFrame === 'Advanced' && renderAdvanced()}
          {timeRangeFrame === 'Custom' && renderCustom()}
          <Divider />
          <div>
            <div className="section-title">{t('Actual Time Range')}</div>
            {validTimeRange && <div>{evalTimeRange}</div>}
            {!validTimeRange && (
              <IconWrapper className="warning">
                <Icon
                  name="error-solid-small"
                  color={supersetTheme.colors.error.base}
                />
                <span className="text error">{evalTimeRange}</span>
              </IconWrapper>
            )}
          </div>
        </StyledModalContainer>
      </Modal>
    </>
  );
}
