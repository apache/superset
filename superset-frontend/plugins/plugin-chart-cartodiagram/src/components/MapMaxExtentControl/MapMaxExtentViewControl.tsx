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
import { Button, Radio } from 'antd';
import React from 'react';
import { mix } from 'polished';
import { RadioChangeEvent } from 'antd/lib/radio';
import {
  MapMaxExtentConfigs,
  MapMaxExtentConfigsControlProps,
} from '../../types';
import MapMaxExtentTag from './MapMaxExtentTag';

export const StyledMaxExtentButton = styled(Button)`
  ${({ theme }) => css`
    flex: 1;
    margin-right: 4px;
    line-height: 1.5715;
    border-radius: ${theme.borderRadius}px;
    background-color: ${theme.colors.primary.light4};
    color: ${theme.colors.primary.dark1};
    font-size: ${theme.typography.sizes.s}px;
    font-weight: ${theme.typography.weights.bold};
    text-transform: uppercase;
    min-width: ${theme.gridUnit * 36};
    min-height: ${theme.gridUnit * 8};
    box-shadow: none;
    border-width: 0px;
    border-style: none;
    border-color: transparent;
    margin-left: 9px;
    margin-top: 10px;
    &:hover {
      background-color: ${mix(
        0.1,
        theme.colors.primary.base,
        theme.colors.primary.light4,
      )};
      color: ${theme.colors.primary.dark1};
    }
  `}
`;

export const StyledMaxExtentTag = styled(MapMaxExtentTag)`
  ${() => css`
    margin-left: 9px;
  `}
`;

export const MapMaxExtentViewControl: React.FC<
  MapMaxExtentConfigsControlProps
> = ({
  value,
  onChange = () => {},
  name,
  label,
  description,
  renderTrigger,
  hovered,
  validationErrors,
}) => {
  const isCustomMode = () => value?.extentMode === 'CUSTOM';

  const onModeChange = (e: RadioChangeEvent) => {
    if (!value) return;

    const newMode = e.target.value;
    let changedValue: MapMaxExtentConfigs = {
      ...value,
      extentMode: newMode,
    };
    if (newMode === 'NONE') {
      changedValue = {
        ...value,
        fixedMaxX: undefined,
        fixedMaxY: undefined,
        fixedMinX: undefined,
        fixedMinY: undefined,
        extentMode: newMode,
      };
    }

    onChange(changedValue);
  };

  const onButtonClick = () => {
    if (!value) return;

    const changedValue: MapMaxExtentConfigs = {
      ...value,
      fixedMaxX: value?.maxX,
      fixedMaxY: value?.maxY,
      fixedMinX: value?.minX,
      fixedMinY: value?.minY,
    };

    onChange(changedValue);
  };

  const modeNameNone = t('NONE');
  const modeNameCustom = t('CUSTOM');
  const extentButtonText = t('Use current extent');

  const controlHeaderProps = {
    name,
    label,
    description,
    renderTrigger,
    hovered,
    validationErrors,
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
      }}
    >
      <ControlHeader {...controlHeaderProps} />
      <Radio.Group
        onChange={onModeChange}
        value={value ? value.extentMode : undefined}
        name="extentMode"
        style={{ marginLeft: '9px' }}
      >
        <Radio value="NONE">{modeNameNone}</Radio>
        <Radio value="CUSTOM">{modeNameCustom}</Radio>
      </Radio.Group>
      {isCustomMode() && value && <StyledMaxExtentTag value={value} />}
      {isCustomMode() && (
        <StyledMaxExtentButton
          onClick={onButtonClick}
          size="small"
          style={{ alignSelf: 'flex-start' }}
        >
          {extentButtonText}
        </StyledMaxExtentButton>
      )}
    </div>
  );
};

export default MapMaxExtentViewControl;
