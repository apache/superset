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
import { useSelector } from 'react-redux';
import { t, customTimeRangeDecode } from '@superset-ui/core';
import { Moment } from 'moment';
import moment from 'moment-timezone';
import { useTimezone } from 'src/components/TimezoneContext';
import { isInteger } from 'lodash';
// @ts-ignore
import { locales } from 'antd/dist/antd-with-locales';
import { Col, Row } from 'src/components';
import { DatePicker } from 'src/components/DatePicker';
import Select from 'src/components/Select/Select';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import {
  SINCE_MODE_OPTIONS,
  UNTIL_MODE_OPTIONS,
  MOMENT_FORMAT,
  MIDNIGHT,
  customTimeRangeEncode,
  dttmToMoment,
  LOCALE_MAPPING,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CustomRangeKey,
  FrameComponentProps,
} from 'src/explore/components/controls/DateFilterControl/types';
import { ExplorePageState } from 'src/explore/types';

export function CustomFrame(props: FrameComponentProps) {
  const { timezone } = useTimezone();
  const { customRange, matchedFlag } = customTimeRangeDecode(props.value);
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
    if (isInteger(value) && value > 0) {
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

  // check if there is a locale defined for explore
  const localFromFlaskBabel = useSelector(
    (state: ExplorePageState) => state?.common?.locale,
  );
  // An undefined datePickerLocale is acceptable if no match is found in the LOCALE_MAPPING[localFromFlaskBabel] lookup
  // and will fall back to antd's default locale when the antd DataPicker's prop locale === undefined
  // This also protects us from the case where state is populated with a locale that antd locales does not recognize
  const datePickerLocale =
    locales[LOCALE_MAPPING[localFromFlaskBabel]]?.DatePicker;

  // Helper functions for timezone-aware date handling
  const convertToTimezone = (datetime: string): Moment => {
    const converted = moment.tz(datetime, timezone);
    return converted;
  };

  const convertFromTimezone = (momentDate: Moment): string => {
    const result = momentDate.clone().tz(timezone).format(MOMENT_FORMAT);
    return result;
  };

  return (
    <div data-test="custom-frame">
      <div className="section-title">{t('Configure custom time range')}</div>
      <Row gutter={24}>
        <Col span={12}>
          <div className="control-label">
            {t('START (INCLUSIVE)')}{' '}
            <InfoTooltipWithTrigger
              tooltip={t('Start date included in time range')}
              placement="right"
            />
          </div>
          <Select
            ariaLabel={t('START (INCLUSIVE)')}
            options={SINCE_MODE_OPTIONS}
            value={sinceMode}
            onChange={(value: string) => onChange('sinceMode', value)}
          />
          {sinceMode === 'specific' && (
            <Row>
              <DatePicker
                showTime
                defaultValue={convertToTimezone(sinceDatetime)}
                onChange={(datetime: Moment) =>
                  onChange('sinceDatetime', convertFromTimezone(datetime))
                }
                allowClear={false}
                locale={datePickerLocale}
              />
            </Row>
          )}
        </Col>
        <Col span={12}>
          <div className="control-label">
            {t('END (EXCLUSIVE)')}{' '}
            <InfoTooltipWithTrigger
              tooltip={t('End date excluded from time range')}
              placement="right"
            />
          </div>
          <Select
            ariaLabel={t('END (EXCLUSIVE)')}
            options={UNTIL_MODE_OPTIONS}
            value={untilMode}
            onChange={(value: string) => onChange('untilMode', value)}
          />
          {untilMode === 'specific' && (
            <Row>
              <DatePicker
                showTime
                defaultValue={convertToTimezone(untilDatetime)}
                onChange={(datetime: Moment) =>
                  onChange('untilDatetime', convertFromTimezone(datetime))
                }
                allowClear={false}
                locale={datePickerLocale}
              />
            </Row>
          )}
        </Col>
      </Row>
    </div>
  );
}
