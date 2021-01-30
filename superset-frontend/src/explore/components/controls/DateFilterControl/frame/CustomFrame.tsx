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
import { Moment } from 'moment';
import { isInteger } from 'lodash';
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
  MIDNIGHT,
} from '../constants';
import {
  customTimeRangeDecode,
  customTimeRangeEncode,
  dttmToMoment,
} from '../utils';
import {
  CustomRangeKey,
  SelectOptionType,
  FrameComponentProps,
} from '../types';

export function CustomFrame(props: FrameComponentProps) {
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

  return (
    <div data-test="custom-frame">
      <div className="section-title">{t('Configure custom time range')}</div>
      <Row gutter={24}>
        <Col span={12}>
          <div className="control-label">{t('START')}</div>
          <Select
            options={SINCE_MODE_OPTIONS}
            value={SINCE_MODE_OPTIONS.filter(
              option => option.value === sinceMode,
            )}
            onChange={(option: SelectOptionType) =>
              onChange('sinceMode', option.value)
            }
          />
          {sinceMode === 'specific' && (
            <Row>
              <DatePicker
                showTime
                value={dttmToMoment(sinceDatetime)}
                onSelect={(datetime: Moment) =>
                  onChange('sinceDatetime', datetime.format(MOMENT_FORMAT))
                }
                allowClear={false}
              />
            </Row>
          )}
          {sinceMode === 'relative' && (
            <Row gutter={8}>
              <Col span={11}>
                {/* Make sure sinceGrainValue looks like a positive integer */}
                <InputNumber
                  placeholder={t('Relative quantity')}
                  value={Math.abs(sinceGrainValue)}
                  min={1}
                  defaultValue={1}
                  onChange={value =>
                    onGrainValue('sinceGrainValue', value || 1)
                  }
                  onStep={value => onGrainValue('sinceGrainValue', value || 1)}
                />
              </Col>
              <Col span={13}>
                <Select
                  options={SINCE_GRAIN_OPTIONS}
                  value={SINCE_GRAIN_OPTIONS.filter(
                    option => option.value === sinceGrain,
                  )}
                  onChange={(option: SelectOptionType) =>
                    onChange('sinceGrain', option.value)
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
            onChange={(option: SelectOptionType) =>
              onChange('untilMode', option.value)
            }
          />
          {untilMode === 'specific' && (
            <Row>
              <DatePicker
                showTime
                value={dttmToMoment(untilDatetime)}
                onSelect={(datetime: Moment) =>
                  onChange('untilDatetime', datetime.format(MOMENT_FORMAT))
                }
                allowClear={false}
              />
            </Row>
          )}
          {untilMode === 'relative' && (
            <Row gutter={8}>
              <Col span={11}>
                <InputNumber
                  placeholder={t('Relative quantity')}
                  value={untilGrainValue}
                  min={1}
                  defaultValue={1}
                  onChange={value =>
                    onGrainValue('untilGrainValue', value || 1)
                  }
                  onStep={value => onGrainValue('untilGrainValue', value || 1)}
                />
              </Col>
              <Col span={13}>
                <Select
                  options={UNTIL_GRAIN_OPTIONS}
                  value={UNTIL_GRAIN_OPTIONS.filter(
                    option => option.value === untilGrain,
                  )}
                  onChange={(option: SelectOptionType) =>
                    onChange('untilGrain', option.value)
                  }
                />
              </Col>
            </Row>
          )}
        </Col>
      </Row>
      {sinceMode === 'relative' && untilMode === 'relative' && (
        <div className="control-anchor-to">
          <div className="control-label">{t('Anchor to')}</div>
          <Row align="middle">
            <Col>
              <Radio.Group
                onChange={onAnchorMode}
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
                  onSelect={(datetime: Moment) =>
                    onChange('anchorValue', datetime.format(MOMENT_FORMAT))
                  }
                  allowClear={false}
                  className="control-anchor-to-datetime"
                />
              </Col>
            )}
          </Row>
        </div>
      )}
    </div>
  );
}
