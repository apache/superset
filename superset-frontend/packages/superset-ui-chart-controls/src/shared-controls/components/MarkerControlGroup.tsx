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
import { Switch, Slider, InputNumber, Row, Col } from 'antd';

export interface MarkerControlGroupProps {
  enabledLabel?: string;
  sizeLabel?: string;
  maxSize?: number;
  minSize?: number;
  defaultSize?: number;
  values?: {
    markerEnabled?: boolean;
    markerSize?: number;
  };
  onChange?: (name: string, value: any) => void;
  disabled?: boolean;
}

const MarkerControlGroup: FC<MarkerControlGroupProps> = ({
  enabledLabel = t('Show markers'),
  sizeLabel = t('Marker size'),
  maxSize = 20,
  minSize = 0,
  defaultSize = 6,
  values = {},
  onChange = () => {},
  disabled = false,
}) => {
  const markerEnabled = values.markerEnabled ?? false;
  const markerSize = values.markerSize ?? defaultSize;

  const handleEnabledChange = (checked: boolean) => {
    onChange('markerEnabled', checked);
    if (checked && !values.markerSize) {
      onChange('markerSize', defaultSize);
    }
  };

  const handleSizeChange = (value: number) => {
    onChange('markerSize', value);
  };

  const handleInputChange = (value: number | null) => {
    if (value !== null) {
      const clampedValue = Math.max(minSize, Math.min(maxSize, value));
      onChange('markerSize', clampedValue);
    }
  };

  return (
    <div className="marker-control-group">
      <div className="control-row" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch
            checked={markerEnabled}
            onChange={handleEnabledChange}
            disabled={disabled}
          />
          {enabledLabel}
        </label>
        <small className="text-muted">
          {t('Draw markers on data points for better visibility')}
        </small>
      </div>

      {markerEnabled && (
        <div className="control-row" style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            {sizeLabel}
          </label>
          <Row gutter={16} align="middle">
            <Col span={16}>
              <Slider
                min={minSize}
                max={maxSize}
                step={1}
                value={markerSize}
                onChange={handleSizeChange}
                disabled={disabled || !markerEnabled}
                marks={{
                  [minSize]: minSize.toString(),
                  [Math.floor(maxSize / 2)]: Math.floor(maxSize / 2).toString(),
                  [maxSize]: maxSize.toString(),
                }}
              />
            </Col>
            <Col span={8}>
              <InputNumber
                min={minSize}
                max={maxSize}
                step={1}
                value={markerSize}
                onChange={handleInputChange}
                disabled={disabled || !markerEnabled}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
          <small className="text-muted">
            {t('Size of the markers in pixels')}
          </small>
        </div>
      )}
    </div>
  );
};

export default MarkerControlGroup;
