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
import React from 'react';
import { t } from '@superset-ui/core';
import moment, { Moment } from 'moment';
import {
  Col,
  DatePicker,
  InputNumber,
  Radio,
  Row,
} from 'src/common/components';
import { Select } from 'src/components/Select';
import {
  SINCE_GRAIN_OPTIONS,
  SINCE_MODE_OPTIONS,
  UNTIL_GRAIN_OPTIONS,
  UNTIL_MODE_OPTIONS,
  MOMENT_FORMAT,
  DEFAULT_UNTIL,
} from './constants';
import { customTimeRangeDecode, customTimeRangeEncode } from './utils';
import { CustomRangeKey } from './types';

const dttmToMoment = (dttm: string): Moment => {
  if (dttm === 'now') {
    return moment().utc().startOf('second');
  }
  if (dttm === 'today') {
    return moment().utc().startOf('day');
  }
  return moment(dttm);
};

type CustomFrameProps = {
  onChange: (timeRange: string) => void;
  value: string;
};
export default function CustomFrame(props: CustomFrameProps) {
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

  function onCustomRangeChange(
    control: CustomRangeKey,
    value: string | number,
  ) {
    props.onChange(
      customTimeRangeEncode({
        ...customRange,
        [control]: value,
      }),
    );
  }

  function onCustomRangeChangeAnchorMode(option: any) {
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
          anchorValue: DEFAULT_UNTIL,
          anchorMode: radioValue,
        }),
      );
    }
  }

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
