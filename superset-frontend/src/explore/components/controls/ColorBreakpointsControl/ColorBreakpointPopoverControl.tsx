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
`;

const StyledRow = styled(Row)`
  width: 100%;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const determineErrorMap = (gradientBreakpoint: ColorBreakpointType) => {
  const errorMap: ErrorMapType = {
    minValue: [],
    maxValue: [],
    color: [],
  };
  const minValueError = validateNumber(gradientBreakpoint.minValue);
  if (minValueError) errorMap.minValue.push(minValueError);

  const maxValueError = validateNumber(gradientBreakpoint.maxValue);
  if (maxValueError) errorMap.maxValue.push(maxValueError);

  // Isoband only validation
  // if (tab === GradientBreakpointType.Isoband) {
  //   const upperThresholdError = legacyValidateInteger(contour.upperThreshold);
  //   if (upperThresholdError) errorMap.upperThreshold.push(upperThresholdError);
  //   if (
  //     !upperThresholdError &&
  //     !lowerThresholdError &&
  //     contour.upperThreshold &&
  //     contour.lowerThreshold
  //   ) {
  //     const lower = parseFloat(contour.lowerThreshold);
  //     const upper = parseFloat(contour.upperThreshold);
  //     if (lower >= upper) {
  //       errorMap.lowerThreshold.push(
  //         t('Lower threshold must be lower than upper threshold'),
  //       );
  //       errorMap.upperThreshold.push(
  //         t('Upper threshold must be greater than lower threshold'),
  //       );
  //     }
  //   }
  // }
  return errorMap;
};

const convertColorBreakpointToNumeric = (
  colorBreakpoint: ColorBreakpointType,
) => {
  const formattedColorBreapoint = {
    color: colorBreakpoint.color,
    minValue: Number(colorBreakpoint.minValue),
    maxValue: Number(colorBreakpoint.maxValue),
  };
  return formattedColorBreapoint;
};

// const formatIsoline = (contour: GradientBreakpointType) => ({
//   color: contour.color,
//   lowerThreshold: contour.lowerThreshold,
//   upperThreshold: undefined,
//   strokeWidth: contour.strokeWidth,
// });

// const formatIsoband = (contour: GradientBreakpointType) => ({
//   color: contour.color,
//   lowerThreshold: contour.lowerThreshold,
//   upperThreshold: contour.upperThreshold,
//   strokeWidth: undefined,
// });

const DEFAULT_CONTOUR: ColorBreakpointType = {
  minValue: undefined,
  maxValue: undefined,
  color: undefined,
};

const ColorBreakpointsPopoverControl = ({
  value: initialValue,
  onSave,
  onClose,
}: ColorBreakpointsPopoverControlProps) => {
  const [gradientBreakpoint, setGradientBreakpoint] = useState(
    initialValue || DEFAULT_CONTOUR,
  );
  const [validationErrors, setValidationErrors] = useState(
    determineErrorMap(initialValue || DEFAULT_CONTOUR),
  );
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const validMinValue =
      Boolean(gradientBreakpoint.minValue) || gradientBreakpoint.minValue === 0;
    const validMaxValue =
      Boolean(gradientBreakpoint.maxValue) || gradientBreakpoint.maxValue === 0;
    const validColor =
      typeof gradientBreakpoint.color === 'object' &&
      'r' in gradientBreakpoint.color &&
      typeof gradientBreakpoint.color.r === 'number' &&
      'g' in gradientBreakpoint.color &&
      typeof gradientBreakpoint.color.g === 'number' &&
      'b' in gradientBreakpoint.color &&
      typeof gradientBreakpoint.color.b === 'number' &&
      'a' in gradientBreakpoint.color &&
      typeof gradientBreakpoint.color.a === 'number';

    const errors = determineErrorMap(gradientBreakpoint);
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
  }, [gradientBreakpoint, isComplete, validationErrors]);

  const updateColor = (rgb: ColorType) => {
    const newContour = { ...gradientBreakpoint };
    newContour.color = { ...rgb, a: 100 };
    setGradientBreakpoint(newContour);
  };

  const updateMinValue = (value: number | string) => {
    const newContour = { ...gradientBreakpoint };
    newContour.minValue = value;
    setGradientBreakpoint(newContour);
  };

  const updateMaxValue = (value: number | string) => {
    const newContour = { ...gradientBreakpoint };
    newContour.maxValue = value;
    setGradientBreakpoint(newContour);
  };

  const containsErrors = () => {
    const keys = Object.keys(validationErrors);
    return keys.some(
      key => validationErrors[key as keyof ErrorMapType].length > 0,
    );
  };

  const handleSave = () => {
    if (isComplete && onSave) {
      onSave(convertColorBreakpointToNumeric(gradientBreakpoint));
      if (onClose) onClose();
    }
  };

  return (
    <>
      <ContourActionsContainer>
        <StyledRow>
          <Col flex="1">
            <ControlHeader
              name="isoband-threshold-lower"
              label={t('Min value')}
              description={t(
                'The lower limit of the threshold range of the Isoband',
              )}
              validationErrors={validationErrors.minValue}
              hovered
            />
            <TextControl
              value={gradientBreakpoint.minValue || ''}
              onChange={updateMinValue}
            />
          </Col>
          <Col flex="1">
            <ControlHeader
              name="isoband-threshold-upper"
              label={t('Max value')}
              description={t(
                'The upper limit of the threshold range of the Isoband',
              )}
              validationErrors={validationErrors.maxValue}
              hovered
            />
            <TextControl
              value={gradientBreakpoint.maxValue || ''}
              onChange={updateMaxValue}
            />
          </Col>
        </StyledRow>
        <StyledRow>
          <Col flex="1">
            <ControlHeader
              name="isoband-color"
              label={t('Color')}
              description={t('The color of the isoband')}
              validationErrors={validationErrors.color}
              hovered
            />
            <ColorPickerControl
              value={gradientBreakpoint.color}
              onChange={updateColor}
            />
          </Col>
        </StyledRow>
        <Button buttonSize="small" onClick={onClose} cta>
          {t('Close')}
        </Button>
        <Button
          data-test="adhoc-filter-edit-popover-save-button"
          disabled={!isComplete || containsErrors()}
          buttonStyle="primary"
          buttonSize="small"
          onClick={handleSave}
          cta
        >
          {t('Save')}
        </Button>
      </ContourActionsContainer>
    </>
  );
};

export default ColorBreakpointsPopoverControl;
