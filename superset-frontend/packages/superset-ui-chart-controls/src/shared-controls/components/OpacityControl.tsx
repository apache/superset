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
import { FC } from 'react';
import { t } from '@superset-ui/core';
import { Slider, InputNumber, Row, Col } from 'antd';

export interface OpacityControlProps {
  name?: string;
  label?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  marks?: Record<number, string>;
}

const OpacityControl: FC<OpacityControlProps> = ({
  name = 'opacity',
  label = t('Opacity'),
  description = t('Opacity of the elements'),
  min = 0,
  max = 1,
  step = 0.1,
  value = 0.8,
  onChange = () => {},
  disabled = false,
  marks,
}) => {
  const defaultMarks = marks || {
    0: '0%',
    0.25: '25%',
    0.5: '50%',
    0.75: '75%',
    1: '100%',
  };

  const handleSliderChange = (val: number) => {
    onChange(val);
  };

  const handleInputChange = (val: number | null) => {
    if (val !== null) {
      const clampedValue = Math.max(min, Math.min(max, val));
      onChange(clampedValue);
    }
  };

  const percentageValue = Math.round(value * 100);

  return (
    <div className="opacity-control" data-name={name}>
      <label style={{ display: 'block', marginBottom: 8 }}>{label}</label>
      <Row gutter={16} align="middle">
        <Col span={16}>
          <Slider
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleSliderChange}
            marks={defaultMarks}
            disabled={disabled}
            tooltip={{
              formatter: val => `${Math.round((val as number) * 100)}%`,
            }}
          />
        </Col>
        <Col span={8}>
          <InputNumber
            min={min * 100}
            max={max * 100}
            step={step * 100}
            value={percentageValue}
            onChange={val => handleInputChange(val !== null ? val / 100 : null)}
            formatter={val => `${val}%`}
            parser={val => Number((val as string).replace('%', ''))}
            disabled={disabled}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>
      {description && (
        <small
          className="text-muted"
          style={{ display: 'block', marginTop: 4 }}
        >
          {description}
        </small>
      )}
    </div>
  );
};

export default OpacityControl;
