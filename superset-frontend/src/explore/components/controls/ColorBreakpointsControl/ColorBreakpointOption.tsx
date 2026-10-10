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

import { styled } from '@apache-superset/core/theme';
import { ColorBreakpointOptionProps } from './types';
import ColorBreakpointPopoverTrigger from './ColorBreakpointPopoverTrigger';
import { DragContainer } from '../OptionControls';
import Option from '../DndColumnSelectControl/Option';

const BreakpointColorPreview = styled.div`
  width: ${({ theme }) => theme.sizeUnit * 3}px;
  height: ${({ theme }) => theme.sizeUnit * 3}px;
  border-radius: ${({ theme }) => theme.sizeUnit / 2}px;
  background: ${(props: { color: string }) => props.color};
  margin-right: ${({ theme }) => theme.sizeUnit}px;
`;

// Chart params are stored server-side as opaque JSON, so breakpoint color
// channels can arrive as arbitrary strings despite the compile-time numeric
// type. The formatted color is interpolated into a styled-component template
// (a stylesheet, not a per-property style assignment), so each channel must
// be coerced to a plain number to keep attacker-controlled strings from
// injecting CSS rules.
const toRgbChannel = (channel: unknown): number => {
  const value = Number(channel);
  return Number.isFinite(value)
    ? Math.min(255, Math.max(0, Math.round(value)))
    : 0;
};

const ColorBreakpointOption = ({
  breakpoint,
  colorBreakpoints,
  index,
  saveColorBreakpoint,
  onClose,
}: ColorBreakpointOptionProps) => {
  const { color, minValue, maxValue } = breakpoint;

  const formattedColor = color
    ? `rgba(${toRgbChannel(color.r)}, ${toRgbChannel(color.g)}, ${toRgbChannel(
        color.b,
      )}, 1)`
    : '';

  return (
    <ColorBreakpointPopoverTrigger
      saveColorBreakpoint={saveColorBreakpoint}
      value={breakpoint}
      colorBreakpoints={colorBreakpoints}
    >
      <DragContainer data-test="color-breakpoint-trigger">
        <Option index={index} clickClose={onClose} canDelete withCaret>
          <BreakpointColorPreview
            color={formattedColor}
            data-test="color-preview"
          />
          {`${minValue} - ${maxValue}`}
        </Option>
      </DragContainer>
    </ColorBreakpointPopoverTrigger>
  );
};

export default ColorBreakpointOption;
