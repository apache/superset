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
// @ts-ignore
import { locales } from 'antd/dist/antd-with-locales';
import { Col, Row } from 'src/components';
import { DatePicker } from 'src/components/DatePicker';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import {
  MOMENT_FORMAT,
  customTimeRangeEncode,
  LOCALE_MAPPING,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CustomRangeKey,
  FrameComponentProps,
} from 'src/explore/components/controls/DateFilterControl/types';
import { ExplorePageState } from 'src/explore/types';

export function CustomFrame(props: FrameComponentProps) {
  const { timezone } = useTimezone();
  const { customRange: coreCustomRange, matchedFlag } = customTimeRangeDecode(
    props.value,
  );

  // Convert core CustomRange to our simplified CustomRange (only specific mode)
  const customRange = {
    ...coreCustomRange,
    sinceMode: 'specific' as const,
    untilMode: 'specific' as const,
  };

  if (!matchedFlag) {
    props.onChange(customTimeRangeEncode(customRange));
  }
  const { sinceDatetime, untilDatetime } = customRange;

  function onChange(control: CustomRangeKey, value: string) {
    props.onChange(
      customTimeRangeEncode({
        ...customRange,
        [control]: value,
      }),
    );
  }

  // check if there is a locale defined for explore
  const localFromFlaskBabel = useSelector(
    (state: ExplorePageState) => state?.common?.locale,
  );
  // An undefined datePickerLocale is acceptable if no match is found in the LOCALE_MAPPING[localFromFlaskBabel] lookup
  // and will fall back to antd's default locale when the antd DataPicker's prop locale === undefined
  // This also protects us from the case where state is populated with a locale that antd locales does not recognize
  const datePickerLocale =
    localFromFlaskBabel &&
    (LOCALE_MAPPING as any)[localFromFlaskBabel] &&
    locales[(LOCALE_MAPPING as any)[localFromFlaskBabel]]?.DatePicker;

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
            {t('Start Date')}{' '}
            <InfoTooltipWithTrigger
              tooltip={t('Start date included in time range')}
              placement="right"
            />
          </div>
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
        </Col>
        <Col span={12}>
          <div className="control-label">
            {t('End Date')}{' '}
            <InfoTooltipWithTrigger
              tooltip={t('End date excluded from time range')}
              placement="right"
            />
          </div>
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
        </Col>
      </Row>
    </div>
  );
}
