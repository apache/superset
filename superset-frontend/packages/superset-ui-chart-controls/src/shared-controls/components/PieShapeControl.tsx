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
import { Select, Switch, Slider, InputNumber } from 'antd';
import { Row, Col } from '@superset-ui/core/components';

export interface PieShapeControlProps {
  showDonut?: boolean;
  showRoseType?: boolean;
  showRadius?: boolean;
  values?: Record<string, any>;
  onChange?: (name: string, value: any) => void;
}

const ROSE_TYPE_OPTIONS = [
  ['area', t('Area')],
  ['radius', t('Radius')],
  [null, t('None')],
];

const PieShapeControl: FC<PieShapeControlProps> = ({
  showDonut = true,
  showRoseType = true,
  showRadius = true,
  values = {},
  onChange = () => {},
}) => {
  const isDonut = values.donut || false;
  const innerRadius = values.innerRadius || 30;
  const outerRadius = values.outerRadius || 70;

  return (
    <div className="pie-shape-control">
      {/* Donut Toggle */}
      {showDonut && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={isDonut}
                onChange={checked => onChange('donut', checked)}
              />
              {t('Donut')}
            </label>
            <small className="text-muted">
              {t('Do you want a donut or a pie?')}
            </small>
          </Col>
        </Row>
      )}

      {/* Inner Radius (for Donut) */}
      {showRadius && isDonut && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Inner Radius')}</label>
            <Row gutter={16} align="middle">
              <Col span={16}>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={innerRadius}
                  onChange={value => onChange('innerRadius', value)}
                  marks={{
                    0: '0%',
                    50: '50%',
                    100: '100%',
                  }}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  min={0}
                  max={100}
                  step={1}
                  value={innerRadius}
                  onChange={value => onChange('innerRadius', value)}
                  formatter={value => `${value}%`}
                  parser={value => Number((value as string).replace('%', ''))}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <small className="text-muted">
              {t('Inner radius of donut hole')}
            </small>
          </Col>
        </Row>
      )}

      {/* Outer Radius */}
      {showRadius && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Outer Radius')}</label>
            <Row gutter={16} align="middle">
              <Col span={16}>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={outerRadius}
                  onChange={value => onChange('outerRadius', value)}
                  marks={{
                    0: '0%',
                    50: '50%',
                    100: '100%',
                  }}
                />
              </Col>
              <Col span={8}>
                <InputNumber
                  min={0}
                  max={100}
                  step={1}
                  value={outerRadius}
                  onChange={value => onChange('outerRadius', value)}
                  formatter={value => `${value}%`}
                  parser={value => Number((value as string).replace('%', ''))}
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
            <small className="text-muted">
              {t('Outer edge of the pie/donut')}
            </small>
          </Col>
        </Row>
      )}

      {/* Rose Type (Nightingale Chart) */}
      {showRoseType && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Rose Type')}</label>
            <Select
              value={values.roseType || null}
              onChange={value => onChange('roseType', value)}
              style={{ width: '100%' }}
              allowClear
              placeholder={t('None')}
              options={ROSE_TYPE_OPTIONS.map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <small className="text-muted">
              {t('Whether to show as Nightingale chart (polar area chart)')}
            </small>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default PieShapeControl;
