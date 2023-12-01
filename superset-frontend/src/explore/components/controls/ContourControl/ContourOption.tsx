/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with work for additional information
 * regarding copyright ownership.  The ASF licenses file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use file except in compliance
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

import React from 'react';
import { styled, t } from '@superset-ui/core';
import { ContourOptionProps } from './types';
import ContourPopoverTrigger from './ContourPopoverTrigger';
import OptionWrapper from '../DndColumnSelectControl/OptionWrapper';

const StyledOptionWrapper = styled(OptionWrapper)`
  max-width: 100%;
  min-width: 100%;
`;

const StyledListItem = styled.li`
  display: flex;
  align-items: center;
`;

const ColorPatch = styled.div<{ formattedColor: string }>`
  background-color: ${({ formattedColor }) => formattedColor};
  height: ${({ theme }) => theme.gridUnit}px;
  width: ${({ theme }) => theme.gridUnit}px;
  margin: 0 ${({ theme }) => theme.gridUnit}px;
`;

const ContourOption = ({
  contour,
  index,
  saveContour,
  onClose,
  onShift,
}: ContourOptionProps) => {
  const { lowerThreshold, upperThreshold, color, strokeWidth } = contour;

  const isIsoband = upperThreshold;

  const formattedColor = color
    ? `rgba(${color.r}, ${color.g}, ${color.b}, 1)`
    : 'undefined';

  const formatIsoline = (threshold: number, width: number) =>
    `${t('Threshold')}: ${threshold}, ${t('color')}: ${formattedColor}, ${t(
      'stroke width',
    )}: ${width}`;

  const formatIsoband = (threshold: number[]) =>
    `${t('Threshold')}: [${threshold[0]}, ${
      threshold[1]
    }], color: ${formattedColor}`;

  const displayString = isIsoband
    ? formatIsoband([lowerThreshold || -1, upperThreshold])
    : formatIsoline(lowerThreshold || -1, strokeWidth);

  const overlay = (
    <div className="contour-tooltip-overlay">
      <StyledListItem>
        {t('Threshold: ')}
        {isIsoband
          ? `[${lowerThreshold}, ${upperThreshold}]`
          : `${lowerThreshold}`}
      </StyledListItem>
      <StyledListItem>
        {t('Color: ')}
        <ColorPatch formattedColor={formattedColor} /> {formattedColor}
      </StyledListItem>
      {!isIsoband && (
        <StyledListItem>{`${t(
          'Stroke Width:',
        )} ${strokeWidth}`}</StyledListItem>
      )}
    </div>
  );

  return (
    <ContourPopoverTrigger saveContour={saveContour} value={contour}>
      <StyledOptionWrapper
        index={index}
        label={displayString}
        type="ContourOption"
        withCaret
        clickClose={onClose}
        onShiftOptions={onShift}
        tooltipOverlay={overlay}
      />
    </ContourPopoverTrigger>
  );
};

export default ContourOption;
