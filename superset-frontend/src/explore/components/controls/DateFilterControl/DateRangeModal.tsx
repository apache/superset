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
import { t, styled, TimeRangeEndpoints } from '@superset-ui/core';
import {
  Col,
  DatePicker,
  Divider,
  InputNumber,
  Radio,
  Row,
} from 'src/common/components';
import Modal from 'src/common/components/Modal';
import { Select } from 'src/components/Select';

import { Moment } from 'moment';
import { TimeRangeType, panelType, SelectOptionType } from './types';

const SINCE_MODE_OPTIONS: SelectOptionType[] = [
  { value: 'specific', label: t('Specific Date/Time') },
  { value: 'relative', label: t('Relative Date/Time') },
];
const UNTIL_MODE_OPTIONS: SelectOptionType[] = [...SINCE_MODE_OPTIONS];
const ANCHOR_OPTIONS: SelectOptionType[] = [
  { value: 'now', label: t('NOW') },
  { value: 'specific', label: t('Date/Time') },
];

const GRAIN_OPTIONS = [
  { value: 'seconds', label: (rel: string) => `${t('Seconds')} ${rel}` },
  { value: 'minutes', label: (rel: string) => `${t('Minutes')} ${rel}` },
  { value: 'hours', label: (rel: string) => `${t('Hours')} ${rel}` },
  { value: 'days', label: (rel: string) => `${t('Days')} ${rel}` },
  { value: 'weeks', label: (rel: string) => `${t('Weeks')} ${rel}` },
  { value: 'months', label: (rel: string) => `${t('Months')} ${rel}` },
  { value: 'years', label: (rel: string) => `${t('Years')} ${rel}` },
];
const SINCE_GRAIN_OPTIONS: SelectOptionType[] = GRAIN_OPTIONS.map(item => ({
  value: item.value,
  label: item.label(t('Before')),
}));
const UNTIL_GRAIN_OPTIONS: SelectOptionType[] = GRAIN_OPTIONS.map(item => ({
  value: item.value,
  label: item.label(t('After')),
}));

interface DateRangeModalProps {
  animation?: boolean;
  name: string;
  label?: string;
  description?: string;
  onChange?: () => {};
  value?: string;
  height?: number;
  onOpenDateFilterControl?: () => {};
  onCloseDateFilterControl?: () => {};
  endpoints?: TimeRangeEndpoints;

  show: boolean;
  onHide: () => void;
}

const Styles = styled.div`
  .ant-row {
    margin-top: 5px;
  }
`;

export default function DateRangeModal(props: DateRangeModalProps) {
  // const { value = 'Last week', endpoints } = props;

  const defaultTimeRangeObject: TimeRangeType = {
    sinceDatetime: null,
    sinceMode: 'relative',
    sinceGrain: 'seconds',
    sinceGrainValue: 1,
    untilDatetime: null,
    untilMode: 'relative',
    untilGrain: 'seconds',
    untilGrainValue: 1,
    anchorMode: 'now',
    anchorValue: null,
  };
  const [timeRange, setTimeRange] = useState<TimeRangeType>(defaultTimeRangeObject);
  const [actualRange, setActualRange] = useState<string | null>(null);

  function updateMode(panel: panelType, option: any) {
    const key = `${panel}Mode`;
    setTimeRange({
      ...timeRange,
      [key]: option.value,
    });
  }

  function updateTime(panel: panelType, datetime: Moment) {
    const key = `${panel}Datetime`;
    setTimeRange({
      ...timeRange,
      [key]: datetime,
    });
  }

  function updateGrain(panel: panelType, option: any) {
    const key = `${panel}Grain`;
    setTimeRange({
      ...timeRange,
      [key]: option.value,
    });
  }

  function updateGrainValue(
    panel: panelType,
    value: number | string | undefined,
  ) {
    const key = `${panel}GrainValue`;
    setTimeRange({
      ...timeRange,
      [key]: value,
    });
  }

  function updateAnchorMode(event: any) {
    setTimeRange({
      ...timeRange,
      anchorMode: event.target.value,
    });
  }

  function updateAnchorValue(datetime: any) {
    setTimeRange({
      ...timeRange,
      anchorValue: datetime,
    });
  }

  function getTimeRangeObject(): TimeRangeType {
    let timeRangeObject: TimeRangeType = {};
    // collect since panel
    if (timeRange.sinceMode === 'relative') {
      timeRangeObject = {
        ...timeRangeObject,
        sinceMode: timeRange.sinceMode,
        sinceGrain: timeRange.sinceGrain,
        sinceGrainValue: timeRange.sinceGrainValue,
      };
    } else {
      timeRangeObject = {
        ...timeRangeObject,
        sinceMode: timeRange.sinceMode,
        sinceDatetime: timeRange.sinceDatetime,
      };
    }

    // collect until panel
    if (timeRange.untilMode === 'relative') {
      timeRangeObject = {
        ...timeRangeObject,
        untilMode: timeRange.untilMode,
        untilGrain: timeRange.untilGrain,
        untilGrainValue: timeRange.untilGrainValue,
      };
    } else {
      timeRangeObject = {
        ...timeRangeObject,
        untilMode: timeRange.untilMode,
        untilDatetime: timeRange.untilDatetime,
      };
    }

    // collect anchor panel
    if (
      timeRange.sinceMode === 'relative' &&
      timeRange.untilMode === 'relative') {
      if (timeRange.anchorMode === 'now') {
        timeRangeObject = {
          ...timeRangeObject,
          anchorMode: timeRange.anchorMode,
          anchorValue: timeRange.anchorValue,
        };
      } else {
        timeRangeObject = {
          ...timeRangeObject,
          anchorMode: timeRange.anchorMode,
          anchorValue: timeRange.anchorValue,
        };
      }
    }

    return timeRangeObject;
  }

  useEffect(() => {
    setActualRange("world");
    console.log(getTimeRangeObject());
  }, [timeRange])

  return (
    <Modal
      title="Range"
      show={props.show}
      onHide={props.onHide}
      onHandledPrimaryAction={()=>{}}
      primaryButtonName={t('APPLY')}
      primaryButtonType="primary"
    >
      <Styles>
        <Row gutter={8}>
          <Col span={12}>
            {t('START')}
            <Select
              name="select-start-type"
              options={SINCE_MODE_OPTIONS}
              value={SINCE_MODE_OPTIONS.filter(
                option => option.value === timeRange.sinceMode,
              )}
              onChange={option => updateMode('since', option)}
            />
            {timeRange.sinceMode === 'specific' && (
              <Row>
                <DatePicker
                  showTime
                  value={timeRange.sinceDatetime}
                  format="YYYY-MM-DD hh:mm:ss"
                  onChange={(datetime: any) => {
                    updateTime('since', datetime);
                  }}
                />
              </Row>
            )}
            {timeRange.sinceMode === 'relative' && (
              <Row gutter={8}>
                <Col span={10}>
                  <InputNumber
                    placeholder={t('Relative quantity')}
                    value={timeRange.sinceGrainValue}
                    min={1}
                    defaultValue={1}
                    onChange={value => updateGrainValue('since', value)}
                  />
                </Col>
                <Col span={14}>
                  <Select
                    options={SINCE_GRAIN_OPTIONS}
                    value={SINCE_GRAIN_OPTIONS.filter(
                      option => option.value === timeRange.sinceGrain,
                    )}
                    onChange={option => updateGrain('since', option)}
                  />
                </Col>
              </Row>
            )}
          </Col>
          <Col span={12}>
            {t('END')}
            <Select
              options={UNTIL_MODE_OPTIONS}
              value={UNTIL_MODE_OPTIONS.filter(
                option => option.value === timeRange.untilMode,
              )}
              onChange={option => updateMode('until', option)}
            />
            {timeRange.untilMode === 'specific' && (
              <Row>
                <DatePicker
                  showTime
                  value={timeRange.untilDatetime}
                  format="YYYY-MM-DD hh:mm:ss"
                  onChange={(datetime: any) => {
                    updateTime('until', datetime);
                  }}
                />
              </Row>
            )}
            {timeRange.untilMode === 'relative' && (
              <Row gutter={8}>
                <Col span={10}>
                  <InputNumber
                    placeholder={t('Relative quantity')}
                    value={timeRange.untilGrainValue}
                    min={1}
                    defaultValue={1}
                    onChange={value => updateGrainValue('until', value)}
                  />
                </Col>
                <Col span={14}>
                  <Select
                    options={UNTIL_GRAIN_OPTIONS}
                    value={UNTIL_GRAIN_OPTIONS.filter(
                      option => option.value === timeRange.untilGrain,
                    )}
                    onChange={(option: any) => updateGrain('until', option)}
                  />
                </Col>
              </Row>
            )}
          </Col>
        </Row>
        {timeRange.sinceMode === 'relative' &&
          timeRange.untilMode === 'relative' && (
            <>
              <Row>{t('ANCHOR RELATIVE TO')}</Row>
              <Row align="middle">
                <Radio.Group onChange={updateAnchorMode} defaultValue="now">
                  {ANCHOR_OPTIONS.map(option => (
                    <Radio key={option.value} value={option.value}>
                      {option.label}
                    </Radio>
                  ))}
                </Radio.Group>
                {timeRange.anchorMode === 'specific' && (
                  <DatePicker
                    showTime
                    value={timeRange.anchorValue}
                    format="YYYY-MM-DD hh:mm:ss"
                    onChange={updateAnchorValue}
                  />
                )}
              </Row>
            </>
          )}
        <Divider />
        <p>{t('ACTUAL TIME RANGE')}</p>
        <p>{actualRange}</p>
      </Styles>
    </Modal>
  );
}
