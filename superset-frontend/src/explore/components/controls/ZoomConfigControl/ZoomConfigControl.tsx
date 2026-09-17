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
import { ControlHeader } from '@superset-ui/chart-controls';
import { css, styled, t } from '@superset-ui/core';
import { Form, Tag } from 'antd';
import { FC, useState } from 'react';
import { isZoomConfigsLinear, isZoomConfigsExp } from './typeguards';
import { ZoomConfigs, ZoomConfigsControlProps } from './types';
import {
  computeConfigValues,
  toFixedConfig,
  toLinearConfig,
  toExpConfig,
} from './zoomUtil';
import ZoomConfigsChart from './ZoomConfigsChart';
import { ControlFormItem } from '../ColumnConfigControl/ControlForm';

export const StyledControlFormItem = styled(ControlFormItem)`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadius}px;
  `}
`;

export const ZoomConfigControl: FC<ZoomConfigsControlProps> = ({
  value,
  onChange = () => {},
  name,
  label,
  description,
  renderTrigger,
  hovered,
  validationErrors,
}) => {
  const initBaseWidth = value ? value.configs.width : 0;
  const initBaseHeight = value ? value.configs.height : 0;
  const initBaseSlope =
    value?.configs.slope !== undefined ? value.configs.slope : 0;
  const initBaseExponent =
    value?.configs.exponent !== undefined ? value.configs.exponent : 0;

  const [baseWidth, setBaseWidth] = useState<number>(initBaseWidth);
  const [baseHeight, setBaseHeight] = useState<number>(initBaseHeight);
  const [baseSlope, setBaseSlope] = useState<number>(initBaseSlope);
  const [baseExponent, setBaseExponent] = useState<number>(initBaseExponent);

  const onChartChange = (newConfig: ZoomConfigs) => {
    onChange(newConfig);
  };

  const onBaseWidthChange = (width: number) => {
    console.log('now in onbasewidthcahnge');
    setBaseWidth(width);
    if (!value) {
      return;
    }

    const newValue = { ...value };
    newValue.configs.width = width;
    newValue.values = computeConfigValues(newValue);
    onChange(newValue);
  };

  const onBaseHeightChange = (height: number) => {
    setBaseHeight(height);
    if (!value) {
      return;
    }

    const newValue = { ...value };
    newValue.configs.height = height;
    newValue.values = computeConfigValues(newValue);
    onChange(newValue);
  };

  const onBaseSlopeChange = (slope: number) => {
    setBaseSlope(slope);
    if (value && isZoomConfigsLinear(value)) {
      const newValue = { ...value };
      newValue.configs.slope = slope;
      newValue.values = computeConfigValues(newValue);
      onChange(newValue);
    }
  };

  const onBaseExponentChange = (exponent: number) => {
    setBaseExponent(exponent);
    if (value && isZoomConfigsExp(value)) {
      const newValue = { ...value };
      newValue.configs.exponent = exponent;
      newValue.values = computeConfigValues(newValue);
      onChange(newValue);
    }
  };

  const onShapeChange = (shape: ZoomConfigs['type']) => {
    if (!value) return;

    const baseValues = {
      width: baseWidth,
      height: baseHeight,
      slope: baseSlope,
      exponent: baseExponent,
      zoom: value?.configs.zoom,
    };

    switch (shape) {
      case 'FIXED': {
        const newFixedConfig = toFixedConfig(baseValues);
        onChange(newFixedConfig);
        break;
      }
      case 'LINEAR': {
        const newLinearConfig = toLinearConfig(baseValues);
        onChange(newLinearConfig);
        break;
      }
      case 'EXP': {
        const newLogConfig = toExpConfig(baseValues);
        onChange(newLogConfig);
        break;
      }
      default:
        break;
    }
  };

  const controlHeaderProps = {
    name,
    label,
    description,
    renderTrigger,
    hovered,
    validationErrors,
  };

  const shapeLabel = t('Shape');
  const shapeDescription = t(
    'Select shape for computing values. "FIXED" sets all zoom levels to the same size. "LINEAR" increases sizes linearly based on specified slope. "EXP" increases sizes exponentially based on specified exponent',
  );
  const baseWidthLabel = t('Base width');
  const baseWidthDescription = t(
    'The width of the current zoom level to compute all widths from',
  );
  const baseHeightLabel = t('Base height');
  const baseHeightDescription = t(
    'The height of the current zoom level to compute all heights from',
  );
  const baseSlopeLabel = t('Base slope');
  const baseSlopeDescription = t(
    'The slope to compute all sizes from. "LINEAR" only',
  );
  const baseExponentLabel = t('Base exponent');
  const baseExponentDescription = t(
    'The exponent to compute all sizes from. "EXP" only',
  );

  return (
    <div>
      <ControlHeader {...controlHeaderProps} />
      <Form>
        <StyledControlFormItem
          controlType="RadioButtonControl"
          label={shapeLabel}
          description={shapeDescription}
          options={[
            ['FIXED', 'FIXED'],
            ['LINEAR', 'LINEAR'],
            ['EXP', 'EXP'],
          ]}
          value={value ? value.type : undefined}
          name="shape"
          onChange={onShapeChange}
        />
        <StyledControlFormItem
          controlType="Slider"
          label={baseWidthLabel}
          description={baseWidthDescription}
          value={baseWidth}
          name="baseWidth"
          // @ts-ignore
          onAfterChange={onBaseWidthChange}
          step={1}
          min={0}
          max={500}
        />
        <StyledControlFormItem
          controlType="Slider"
          label={baseHeightLabel}
          description={baseHeightDescription}
          value={baseHeight}
          name="baseHeight"
          // @ts-ignore
          onAfterChange={onBaseHeightChange}
          step={1}
          min={0}
          max={500}
        />
        <StyledControlFormItem
          controlType="Slider"
          label={baseSlopeLabel}
          description={baseSlopeDescription}
          value={baseSlope}
          name="slope"
          // @ts-ignore
          onAfterChange={onBaseSlopeChange}
          disabled={!!(value && !isZoomConfigsLinear(value))}
          step={1}
          min={0}
          max={100}
        />
        <StyledControlFormItem
          controlType="Slider"
          label={baseExponentLabel}
          description={baseExponentDescription}
          value={baseExponent}
          name="exponent"
          // @ts-ignore
          onAfterChange={onBaseExponentChange}
          disabled={!!(value && !isZoomConfigsExp(value))}
          step={0.2}
          min={0}
          max={3}
        />
        <Tag>Current Zoom: {value?.configs.zoom}</Tag>
      </Form>
      <ZoomConfigsChart
        name="zoomlevels"
        value={value}
        onChange={onChartChange}
      />
    </div>
  );
};

export default ZoomConfigControl;
