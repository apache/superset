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
import { useState, useEffect } from 'react';
import { Button, Row, Col } from '@superset-ui/core/components';
import { styled, t, validateNumber } from '@superset-ui/core';
import ControlHeader from '../../ControlHeader';
import TextControl from '../TextControl';
import ColorPickerControl from '../ColorPickerControl';
import {
  ColorBreakpointsPopoverControlProps,
  ColorType,
  ColorBreakpointType,
  ErrorMapType,
} from './types';

const ContourActionsContainer = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  display: flex;
  justify-content: flex-end;
`;

const StyledRow = styled(Row)`
  width: 100%;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
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

  if (
    !Number.isNaN(colorBreakpoint.minValue) &&
    !Number.isNaN(colorBreakpoint.maxValue)
  ) {
    const newMinValue = Number(colorBreakpoint.minValue);
    const newMaxValue = Number(colorBreakpoint.maxValue);

    if (newMinValue >= newMaxValue) {
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

const DEFAULT_CONTOUR: ColorBreakpointType = {
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
    initialValue || DEFAULT_CONTOUR,
  );
  const [validationErrors, setValidationErrors] = useState(
    determineErrorMap(initialValue || DEFAULT_CONTOUR, colorBreakpoints),
  );
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const validMinValue =
      Boolean(colorBreakpoint.minValue) ||
      Number(colorBreakpoint.minValue) === 0;
    const validMaxValue =
      Boolean(colorBreakpoint.maxValue) ||
      Number(colorBreakpoint.maxValue) === 0;
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

    const errors = determineErrorMap(colorBreakpoint, colorBreakpoints);
    if (
      JSON.stringify(errors.minValue) !==
        JSON.stringify(validationErrors.minValue) ||
      JSON.stringify(errors.maxValue) !==
        JSON.stringify(validationErrors.maxValue) ||
      JSON.stringify(errors.color) !== JSON.stringify(validationErrors.color)
    ) {
      setValidationErrors(errors);
    }

    const sectionIsComplete = validMinValue && validMaxValue && validColor;

    if (sectionIsComplete !== isComplete) setIsComplete(sectionIsComplete);
  }, [colorBreakpoint, isComplete, validationErrors, colorBreakpoints]);

  const updateColor = (rgb: ColorType) => {
    setColorBreakpoint({
      ...colorBreakpoint,
      color: { ...rgb, a: 100 },
    });
  };

  const updateMinValue = (value: number) => {
    const newBreakpoint = { ...colorBreakpoint };
    newBreakpoint.minValue = value;
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

  const containsErrors = () => {
    const keys = Object.keys(validationErrors);
    return keys.some(
      key => validationErrors[key as keyof ErrorMapType].length > 0,
    );
  };

  const handleSave = () => {
    if (isComplete && onSave) {
      onSave(convertColorBreakpointToNumeric(colorBreakpoint));
      if (onClose) onClose();
    }
  };

  return (
    <>
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
          />
        </Col>
      </StyledRow>
      <StyledRow>
        <Col flex="1">
          <ControlHeader
            name="min-value"
            label={t('Min value')}
            validationErrors={validationErrors.minValue}
            hovered
          />
          <TextControl
            value={colorBreakpoint.minValue}
            onChange={updateMinValue}
          />
        </Col>
        <Col flex="1">
          <ControlHeader
            name="max-value"
            label={t('Max value')}
            validationErrors={validationErrors.maxValue}
            hovered
          />
          <TextControl
            value={colorBreakpoint.maxValue}
            onChange={updateMaxValue}
          />
        </Col>
      </StyledRow>
      <ContourActionsContainer>
        <Button
          buttonSize="small"
          onClick={onClose}
          variant="filled"
          aria-label={t('Close color breakpoint editor')}
        >
          {t('Close')}
        </Button>
        <Button
          disabled={!isComplete || containsErrors()}
          buttonStyle="primary"
          buttonSize="small"
          onClick={handleSave}
          aria-label={t('Save color breakpoint values')}
        >
          {t('Save')}
        </Button>
      </ContourActionsContainer>
    </>
  );
};

export default ColorBreakpointsPopoverControl;
