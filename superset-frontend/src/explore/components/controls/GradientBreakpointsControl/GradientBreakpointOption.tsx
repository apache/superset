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

import { styled, t } from '@superset-ui/core';
import { GradientBreakpointOptionProps } from './types';
import GradientBreakpointsPopoverTrigger from './GradientBreakpointsPopoverTrigger';
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
  height: ${({ theme }) => theme.sizeUnit}px;
  width: ${({ theme }) => theme.sizeUnit}px;
  margin: 0 ${({ theme }) => theme.sizeUnit}px;
`;

const GradientBreakpointOption = ({
  gradientBreakpoint,
  index,
  saveGradientBreakpoint,
  onClose,
  onShift,
}: GradientBreakpointOptionProps) => {
  const { color, minValue, maxValue } = gradientBreakpoint;

  const formattedColor = color
    ? `rgba(${color.r}, ${color.g}, ${color.b}, 1)`
    : 'undefined';

  const overlay = (
    <div className="contour-tooltip-overlay">
      <StyledListItem>
        {t('Min value`: ')}
        {minValue}
      </StyledListItem>
      <StyledListItem>
        {t('Color: ')}
        <ColorPatch formattedColor={formattedColor} /> {formattedColor}
      </StyledListItem>
      <StyledListItem>
        {t('Max value`: ')}
        {maxValue}
      </StyledListItem>
    </div>
  );

  return (
    <GradientBreakpointsPopoverTrigger
      saveGradientBreakpoint={saveGradientBreakpoint}
      value={gradientBreakpoint}
    >
      <StyledOptionWrapper
        index={index}
        label="Gradient Breakpoint"
        type="ContourOption"
        withCaret
        clickClose={onClose}
        onShiftOptions={onShift}
        tooltipOverlay={overlay}
      />
    </GradientBreakpointsPopoverTrigger>
  );
};

export default GradientBreakpointOption;
