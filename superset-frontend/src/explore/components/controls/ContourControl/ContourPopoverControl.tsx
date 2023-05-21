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
import { Row, Col } from 'src/components';
import Button from 'src/components/Button';
import Tabs from 'src/components/Tabs';
import { styled, t } from '@superset-ui/core';
import ControlHeader from '../../ControlHeader';
import TextControl from '../TextControl';
import ColorPickerControl from '../ColorPickerControl';
import { ContourPopoverControlProps, colorType, contourType } from './types';

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

const getInitTabKey = (contour: contourType | undefined) => {
  return contour && isIsoband(contour)
    ? CONTOUR_TYPES.ISOBAND
    : CONTOUR_TYPES.ISOLINE;
};

const ContourPopoverControl = ({
  value: initialValue,
  onSave,
  onClose,
}: ContourPopoverControlProps) => {
  const [currentTab, setCurrentTab] = useState(getInitTabKey(initialValue));
  const [contour, setContour] = useState(
    initialValue || {
      lowerThreshold: undefined,
      upperThreshold: undefined,
      color: undefined,
      strokeWidth: undefined,
    },
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
    newContour.strokeWidth = Number(value);
    setContour(newContour);
  };

  const updateColor = (rgb: colorType) => {
    const newContour = { ...contour };
    newContour.color = { ...rgb, a: 100 };
    setContour(newContour);
  };

  const updateLowerThreshold = (value: number | string) => {
    const newContour = { ...contour };
    newContour.lowerThreshold = Number(value);
    setContour(newContour);
  };

  const updateUpperThreshold = (value: number | string) => {
    const newContour = { ...contour };
    newContour.upperThreshold = Number(value);
    setContour(newContour);
  };

  const handleSave = () => {
    if (isComplete && onSave) {
      onSave(contour);
    }
  };

  const isobandSection = () => (
    <div className="isoline-popover-section">
      <StyledRow>
        <Col flex="1">
          <ControlHeader
            name="isoline-threshold-lower"
            label="Lower Threshold"
            description="test"
            hovered
          />
          <TextControl
            value={contour.lowerThreshold}
            onChange={updateLowerThreshold}
          />
        </Col>
        <Col flex="1">
          <ControlHeader
            name="isoline-threshold-upper"
            label="Upper Threshold"
            description="test"
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
            name="isoline-color"
            label="Color"
            description="test"
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
            description="test"
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
            description="test"
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
            description="test"
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
        defaultActiveKey={getInitTabKey(initialValue)}
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
          disabled={!isComplete}
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
