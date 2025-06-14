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
import { Row, Col } from 'src/components';
import Button from 'src/components/Button';
import Tabs from 'src/components/Tabs';
import { legacyValidateInteger, styled, t } from '@superset-ui/core';
import ControlHeader from '../../ControlHeader';
import TextControl from '../TextControl';
import ColorPickerControl from '../ColorPickerControl';
import {
  ContourPopoverControlProps,
  ColorType,
  ContourType,
  ErrorMapType,
} from './types';

enum ContourTypes {
  Isoline = 'ISOLINE',
  Isoband = 'ISOBAND',
}

const ContourActionsContainer = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
`;

const StyledRow = styled(Row)`
  width: 100%;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
`;

const isIsoband = (contour: ContourType) => {
  if (Object.keys(contour).length < 4) {
    return false;
  }
  return contour.upperThreshold && contour.lowerThreshold;
};

const getTabKey = (contour: ContourType | undefined) =>
  contour && isIsoband(contour) ? ContourTypes.Isoband : ContourTypes.Isoline;

const determineErrorMap = (tab: string, contour: ContourType) => {
  const errorMap: ErrorMapType = {
    lowerThreshold: [],
    upperThreshold: [],
    strokeWidth: [],
    color: [],
  };
  // Isoline and Isoband validation
  const lowerThresholdError = legacyValidateInteger(contour.lowerThreshold);
  if (lowerThresholdError) errorMap.lowerThreshold.push(lowerThresholdError);

  // Isoline only validation
  if (tab === ContourTypes.Isoline) {
    const strokeWidthError = legacyValidateInteger(contour.strokeWidth);
    if (strokeWidthError) errorMap.strokeWidth.push(strokeWidthError);
  }

  // Isoband only validation
  if (tab === ContourTypes.Isoband) {
    const upperThresholdError = legacyValidateInteger(contour.upperThreshold);
    if (upperThresholdError) errorMap.upperThreshold.push(upperThresholdError);
    if (
      !upperThresholdError &&
      !lowerThresholdError &&
      contour.upperThreshold &&
      contour.lowerThreshold
    ) {
      const lower = parseFloat(contour.lowerThreshold);
      const upper = parseFloat(contour.upperThreshold);
      if (lower >= upper) {
        errorMap.lowerThreshold.push(
          t('Lower threshold must be lower than upper threshold'),
        );
        errorMap.upperThreshold.push(
          t('Upper threshold must be greater than lower threshold'),
        );
      }
    }
  }
  return errorMap;
};

const convertContourToNumeric = (contour: ContourType) => {
  const formattedContour = { ...contour };
  const numericKeys = ['lowerThreshold', 'upperThreshold', 'strokeWidth'];
  numericKeys.forEach(key => {
    formattedContour[key] = Number(formattedContour[key]);
  });
  return formattedContour;
};

const formatIsoline = (contour: ContourType) => ({
  color: contour.color,
  lowerThreshold: contour.lowerThreshold,
  upperThreshold: undefined,
  strokeWidth: contour.strokeWidth,
});

const formatIsoband = (contour: ContourType) => ({
  color: contour.color,
  lowerThreshold: contour.lowerThreshold,
  upperThreshold: contour.upperThreshold,
  strokeWidth: undefined,
});

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
    determineErrorMap(getTabKey(initialValue), initialValue || DEFAULT_CONTOUR),
  );
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const isIsoband = currentTab === ContourTypes.Isoband;
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

    const errors = determineErrorMap(currentTab, contour);
    if (errors !== validationErrors) setValidationErrors(errors);

    const sectionIsComplete = isIsoband
      ? validLower && validUpper && validColor
      : validLower && validColor && validStrokeWidth;

    if (sectionIsComplete !== isComplete) setIsComplete(sectionIsComplete);
  }, [contour, currentTab]);

  const onTabChange = (activeKey: any) => {
    setCurrentTab(activeKey);
  };

  const updateStrokeWidth = (value: number | string) => {
    const newContour = { ...contour };
    newContour.strokeWidth = value;
    setContour(newContour);
  };

  const updateColor = (rgb: ColorType) => {
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
    return keys.some(
      key => validationErrors[key as keyof ErrorMapType].length > 0,
    );
  };

  const handleSave = () => {
    if (isComplete && onSave) {
      const newContour =
        currentTab === ContourTypes.Isoline
          ? formatIsoline(contour)
          : formatIsoband(contour);
      onSave(convertContourToNumeric(newContour));
      if (onClose) onClose();
    }
  };

  return (
    <>
      <Tabs
        id="contour-edit-tabs"
        onChange={onTabChange}
        defaultActiveKey={getTabKey(initialValue)}
      >
        <Tabs.TabPane
          className="adhoc-filter-edit-tab"
          key={ContourTypes.Isoline}
          tab={t('Isoline')}
        >
          <div key={ContourTypes.Isoline} className="isoline-popover-section">
            <StyledRow>
              <Col flex="1">
                <ControlHeader
                  name="isoline-threshold"
                  label={t('Threshold')}
                  description={t(
                    'Defines the value that determines the boundary between different regions or levels in the data ',
                  )}
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
                  label={t('Stroke Width')}
                  description={t('The width of the Isoline in pixels')}
                  validationErrors={validationErrors.strokeWidth}
                  hovered
                />
                <TextControl
                  value={contour.strokeWidth || ''}
                  onChange={updateStrokeWidth}
                />
              </Col>
              <Col flex="1">
                <ControlHeader
                  name="isoline-color"
                  label={t('Color')}
                  description={t('The color of the isoline')}
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
        </Tabs.TabPane>
        <Tabs.TabPane
          className="adhoc-filter-edit-tab"
          key={ContourTypes.Isoband}
          tab={t('Isoband')}
        >
          <div key={ContourTypes.Isoband} className="isoline-popover-section">
            <StyledRow>
              <Col flex="1">
                <ControlHeader
                  name="isoband-threshold-lower"
                  label={t('Lower Threshold')}
                  description={t(
                    'The lower limit of the threshold range of the Isoband',
                  )}
                  validationErrors={validationErrors.lowerThreshold}
                  hovered
                />
                <TextControl
                  value={contour.lowerThreshold || ''}
                  onChange={updateLowerThreshold}
                />
              </Col>
              <Col flex="1">
                <ControlHeader
                  name="isoband-threshold-upper"
                  label={t('Upper Threshold')}
                  description={t(
                    'The upper limit of the threshold range of the Isoband',
                  )}
                  validationErrors={validationErrors.upperThreshold}
                  hovered
                />
                <TextControl
                  value={contour.upperThreshold || ''}
                  onChange={updateUpperThreshold}
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
                  value={contour?.color}
                  onChange={updateColor}
                />
              </Col>
            </StyledRow>
          </div>
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
