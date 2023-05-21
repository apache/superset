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
import { legacyValidateInteger } from '@superset-ui/core';
import { Row, Col } from 'src/components';
import Button from 'src/components/Button';
import Tabs from 'src/components/Tabs';
import { styled, t } from '@superset-ui/core';
import ControlHeader from '../../ControlHeader';
import TextControl from '../TextControl';
import ColorPickerControl from '../ColorPickerControl';
import {
  ContourPopoverControlProps,
  colorType,
  contourType,
  errorMapType,
} from './types';

enum CONTOUR_TYPES {
  ISOLINE = 'ISOLINE',
  ISOBAND = 'ISOBAND',
}

const ContourActionsContainer = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
`;

const StyledRow = styled(Row)`
  width: 100%;
  gap: 10px;
`;

const isIsoband = (contour: contourType) => {
  if (Object.keys(contour).length < 4) {
    return false;
  }
  return contour.upperThreshold && contour.lowerThreshold;
};

const getTabKey = (contour: contourType | undefined) => {
  return contour && isIsoband(contour)
    ? CONTOUR_TYPES.ISOBAND
    : CONTOUR_TYPES.ISOLINE;
};

const determineErrorMap = (contour: contourType) => {
  const type = getTabKey(contour);
  const errorMap: errorMapType = {
    lowerThreshold: [],
    upperThreshold: [],
    strokeWidth: [],
    color: [],
  };
  if (type === CONTOUR_TYPES.ISOBAND) {
    const upperThresholdError = legacyValidateInteger(contour.upperThreshold);
    if (upperThresholdError) errorMap.upperThreshold.push(upperThresholdError);
  }
  const lowerThresholdError = legacyValidateInteger(contour.lowerThreshold);
  const strokeWidthError = legacyValidateInteger(contour.strokeWidth);
  if (lowerThresholdError) errorMap.lowerThreshold.push(lowerThresholdError);
  if (strokeWidthError) errorMap.strokeWidth.push(strokeWidthError);
  return errorMap;
};

const convertContourToNumeric = (contour: contourType) => {
  const formattedContour = { ...contour };
  const numericKeys = ['lowerThreshold', 'upperThreshold', 'strokeWidth'];
  numericKeys.forEach(
    key => (formattedContour[key] = Number(formattedContour[key])),
  );
  return formattedContour;
};

const DEFAULT_CONTOUR = {
  lowerThreshold: undefined,
  upperThreshold: undefined,
  color: undefined,
  strokeWidth: undefined,
};

const ContourPopoverControl = ({
  value: initialValue,
  onSave,
  onClose,
}: ContourPopoverControlProps) => {
  const [currentTab, setCurrentTab] = useState(getTabKey(initialValue));
  const [contour, setContour] = useState(initialValue || DEFAULT_CONTOUR);
  const [validationErrors, setValidationErrors] = useState(
    determineErrorMap(initialValue || DEFAULT_CONTOUR),
  );
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const isIsoband = currentTab === CONTOUR_TYPES.ISOBAND;
    const validLower =
      Boolean(contour.lowerThreshold) || contour.lowerThreshold === 0;
    const validUpper =
      Boolean(contour.upperThreshold) || contour.upperThreshold === 0;
    const validStrokeWidth =
      Boolean(contour.strokeWidth) || contour.strokeWidth === 0;
    const validColor =
      typeof contour.color === 'object' &&
      'r' in contour.color &&
      typeof contour.color.r === 'number' &&
      'g' in contour.color &&
      typeof contour.color.g === 'number' &&
      'b' in contour.color &&
      typeof contour.color.b === 'number' &&
      'a' in contour.color &&
      typeof contour.color.a === 'number';

    const errors = determineErrorMap(contour);
    setValidationErrors(errors);

    setIsComplete(
      isIsoband
        ? validLower && validUpper && validColor
        : validLower && validColor && validStrokeWidth,
    );
  }, [contour, currentTab]);

  const onTabChange = (activeKey: any) => {
    setCurrentTab(activeKey);
  };

  const updateStrokeWidth = (value: number | string) => {
    const newContour = { ...contour };
    newContour.strokeWidth = value;
    setContour(newContour);
  };

  const updateColor = (rgb: colorType) => {
    const newContour = { ...contour };
    newContour.color = { ...rgb, a: 100 };
    setContour(newContour);
  };

  const updateLowerThreshold = (value: number | string) => {
    const newContour = { ...contour };
    newContour.lowerThreshold = value;
    setContour(newContour);
  };

  const updateUpperThreshold = (value: number | string) => {
    const newContour = { ...contour };
    newContour.upperThreshold = value;
    setContour(newContour);
  };

  const containsErrors = () => {
    const keys = Object.keys(validationErrors);
    return keys.some(key => validationErrors[key].length > 0);
  };

  const handleSave = () => {
    if (isComplete && onSave) {
      onSave(convertContourToNumeric(contour));
    }
  };

  const isobandSection = () => (
    <div className="isoline-popover-section">
      <StyledRow>
        <Col flex="1">
          <ControlHeader
            name="isoband-threshold-lower"
            label="Lower Threshold"
            description="The lower limit of the threshold range of the Isoband"
            validationErrors={validationErrors.lowerThreshold}
            hovered
          />
          <TextControl
            value={contour.lowerThreshold}
            onChange={updateLowerThreshold}
          />
        </Col>
        <Col flex="1">
          <ControlHeader
            name="isoband-threshold-upper"
            label="Upper Threshold"
            description="The upper limit of the threshold range of the Isoband"
            validationErrors={validationErrors.upperThreshold}
            hovered
          />
          <TextControl
            value={contour.upperThreshold}
            onChange={updateUpperThreshold}
          />
        </Col>
      </StyledRow>
      <StyledRow>
        <Col flex="1">
          <ControlHeader
            name="isoband-color"
            label="Color"
            description="The color of the isoband"
            validationErrors={validationErrors.color}
            hovered
          />
          <ColorPickerControl
            value={typeof contour === 'object' && contour?.color}
            onChange={updateColor}
          />
        </Col>
      </StyledRow>
    </div>
  );

  const isolineSection = () => (
    <div className="isoline-popover-section">
      <StyledRow>
        <Col flex="1">
          <ControlHeader
            name="isoline-threshold"
            label="Threshold"
            description="Defines the value that determines the boundary between different regions or levels in the data "
            validationErrors={validationErrors.lowerThreshold}
            hovered
          />
          <TextControl
            value={contour.lowerThreshold}
            onChange={updateLowerThreshold}
          />
        </Col>
      </StyledRow>
      <StyledRow>
        <Col flex="1">
          <ControlHeader
            name="isoline-stroke-width"
            label="Stroke Width"
            description="The width of the Isoline in pixels"
            validationErrors={validationErrors.strokeWidth}
            hovered
          />
          <TextControl
            value={contour.strokeWidth}
            onChange={updateStrokeWidth}
          />
        </Col>
        <Col flex="1">
          <ControlHeader
            name="isoline-color"
            label="Color"
            description="The color of the isoline"
            validationErrors={validationErrors.color}
            hovered
          />
          <ColorPickerControl
            value={typeof contour === 'object' && contour?.color}
            onChange={updateColor}
          />
        </Col>
      </StyledRow>
    </div>
  );

  return (
    <>
      <Tabs
        id="contour-edit-tabs"
        onChange={onTabChange}
        defaultActiveKey={getTabKey(initialValue)}
      >
        <Tabs.TabPane
          className="adhoc-filter-edit-tab"
          key={CONTOUR_TYPES.ISOLINE}
          tab="Isoline"
        >
          {isolineSection()}
        </Tabs.TabPane>
        <Tabs.TabPane
          className="adhoc-filter-edit-tab"
          key={CONTOUR_TYPES.ISOBAND}
          tab="Isoband"
        >
          {isobandSection()}
        </Tabs.TabPane>
      </Tabs>
      <ContourActionsContainer>
        <Button buttonSize="small" onClick={onClose} cta>
          {t('Close')}
        </Button>
        <Button
          data-test="adhoc-filter-edit-popover-save-button"
          disabled={!isComplete || containsErrors()}
          buttonStyle="primary"
          buttonSize="small"
          className="m-r-5"
          onClick={handleSave}
          cta
        >
          {t('Save')}
        </Button>
      </ContourActionsContainer>
    </>
  );
};

export default ContourPopoverControl;
