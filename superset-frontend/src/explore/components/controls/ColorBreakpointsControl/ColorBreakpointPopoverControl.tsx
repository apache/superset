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
import { useState, useMemo } from 'react';
import { Button, Row, Col, InputNumber } from '@superset-ui/core/components';
import { styled, t, validateNumber } from '@superset-ui/core';
import ControlHeader from '../../ControlHeader';
import ColorPickerControl from '../ColorPickerControl';
import {
  ColorBreakpointsPopoverControlProps,
  ColorType,
  ColorBreakpointType,
  ErrorMapType,
} from './types';

const ColorBreakpointActionsContainer = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 8}px;
  display: flex;
  justify-content: flex-end;
`;

const StyledRow = styled(Row)`
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ValuesRow = styled(Row)`
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  display: flex;
  align-items: flex-end;
`;

const NumberControlsDivider = styled.div`
  padding: 6px 0;
`;

const FullWidthInputNumber = styled(InputNumber)`
  width: 100%;
`;

const determineErrorMap = (
  colorBreakpoint: ColorBreakpointType,
  colorBreakpoints: ColorBreakpointType[],
) => {
  const errorMap: ErrorMapType = {
    minValue: [],
    maxValue: [],
    color: [],
  };
  const minValueError = validateNumber(colorBreakpoint.minValue);
  if (minValueError) errorMap.minValue.push(minValueError);

  const maxValueError = validateNumber(colorBreakpoint.maxValue);
  if (maxValueError) errorMap.maxValue.push(maxValueError);

  if (minValueError || maxValueError) return errorMap;

  const newMinValue = Number(colorBreakpoint.minValue);
  const newMaxValue = Number(colorBreakpoint.maxValue);

  if (Number.isNaN(newMinValue) || Number.isNaN(newMaxValue)) {
    return errorMap;
  }

  if (newMinValue > newMaxValue) {
    errorMap.minValue.push(
      t('Min value should be smaller or equal to max value'),
    );
  }

  const otherBreakpoints = colorBreakpoints.filter(
    breakpoint => breakpoint.id !== colorBreakpoint.id,
  );

  const isBreakpointDuplicate = !!otherBreakpoints?.find(
    breakpoint =>
      Number(breakpoint.minValue) <= newMaxValue &&
      Number(breakpoint.maxValue) >= newMinValue,
  );

  if (isBreakpointDuplicate) {
    const overlapMsg = t('The values overlap other breakpoint values');

    errorMap.minValue.push(overlapMsg);
    errorMap.maxValue.push(overlapMsg);
  }

  const validColor =
    typeof colorBreakpoint.color === 'object' &&
    'r' in colorBreakpoint.color &&
    typeof colorBreakpoint.color.r === 'number' &&
    'g' in colorBreakpoint.color &&
    typeof colorBreakpoint.color.g === 'number' &&
    'b' in colorBreakpoint.color &&
    typeof colorBreakpoint.color.b === 'number' &&
    'a' in colorBreakpoint.color &&
    typeof colorBreakpoint.color.a === 'number';

  if (!validColor) {
    errorMap.color.push(t('Invalid color'));
  }

  return errorMap;
};

const convertColorBreakpointToNumeric = (
  colorBreakpoint: ColorBreakpointType,
) => {
  const formattedColorBreakpoint = {
    color: colorBreakpoint.color,
    minValue: Number(colorBreakpoint.minValue),
    maxValue: Number(colorBreakpoint.maxValue),
  };
  return formattedColorBreakpoint;
};

const DEFAULT_COLOR_BREAKPOINT: ColorBreakpointType = {
  id: undefined,
  minValue: undefined,
  maxValue: undefined,
  color: { r: 0, g: 0, b: 0, a: 100 },
};

const ColorBreakpointsPopoverControl = ({
  value: initialValue,
  onSave,
  onClose,
  colorBreakpoints,
}: ColorBreakpointsPopoverControlProps) => {
  const [colorBreakpoint, setColorBreakpoint] = useState(
    initialValue || DEFAULT_COLOR_BREAKPOINT,
  );

  const useValidationErrors = (
    colorBreakpoint: ColorBreakpointType,
    colorBreakpoints: ColorBreakpointType[],
  ) =>
    useMemo(
      () => determineErrorMap(colorBreakpoint, colorBreakpoints),
      [colorBreakpoint, colorBreakpoints],
    );

  const validationErrors = useValidationErrors(
    colorBreakpoint,
    colorBreakpoints,
  );

  const updateColor = (rgb: ColorType) => {
    setColorBreakpoint({
      ...colorBreakpoint,
      color: { ...rgb },
    });
  };

  const updateMinValue = (value: number) => {
    setColorBreakpoint({
      ...colorBreakpoint,
      minValue: value,
    });
  };

  const updateMaxValue = (value: number) => {
    setColorBreakpoint({
      ...colorBreakpoint,
      maxValue: value,
    });
  };

  const containsErrors = Object.values(validationErrors).some(
    errors => errors.length > 0,
  );

  const handleSave = () => {
    if (!containsErrors && onSave) {
      onSave(convertColorBreakpointToNumeric(colorBreakpoint));
      if (onClose) onClose();
    }
  };

  return (
    <div role="dialog">
      <StyledRow>
        <Col flex="1">
          <ControlHeader
            name="color"
            label={t('Color for breakpoint')}
            validationErrors={validationErrors.color}
            hovered
          />
          <ColorPickerControl
            value={colorBreakpoint.color}
            onChange={updateColor}
            data-test="color-picker"
          />
        </Col>
      </StyledRow>
      <ValuesRow>
        <Col flex="1">
          <ControlHeader
            name="min-value"
            label={t('Min value')}
            validationErrors={validationErrors.minValue}
            hovered
          />
          <FullWidthInputNumber
            value={colorBreakpoint.minValue}
            onChange={updateMinValue}
            data-test="min-value-input"
          />
        </Col>
        <NumberControlsDivider>-</NumberControlsDivider>
        <Col flex="1">
          <ControlHeader
            name="max-value"
            label={t('Max value')}
            validationErrors={validationErrors.maxValue}
            hovered
          />
          <FullWidthInputNumber
            value={colorBreakpoint.maxValue}
            onChange={updateMaxValue}
            data-test="max-value-input"
          />
        </Col>
      </ValuesRow>
      <ColorBreakpointActionsContainer>
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={onClose}
          aria-label={t('Close color breakpoint editor')}
          data-test="close-button"
        >
          {t('Close')}
        </Button>
        <Button
          disabled={containsErrors}
          buttonStyle="primary"
          buttonSize="small"
          onClick={handleSave}
          aria-label={t('Save color breakpoint values')}
          data-test="save-button"
        >
          {t('Save')}
        </Button>
      </ColorBreakpointActionsContainer>
    </div>
  );
};

export default ColorBreakpointsPopoverControl;
