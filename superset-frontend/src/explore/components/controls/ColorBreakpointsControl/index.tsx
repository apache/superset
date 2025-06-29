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

import { useState, useEffect } from 'react';
import { styled, t } from '@superset-ui/core';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import ColorBreakpointOption from './ColorBreakpointOption';
import { ColorBreakpointType, ColorBreakpointsControlProps } from './types';
import ColorBreakpointsPopoverTrigger from './ColorBreakpointsPopoverTrigger';

const DEFAULT_COLOR_BREAKPOINTS: ColorBreakpointType[] = [
  {
    minValue: 1,
    maxValue: 10,
    color: { r: 0, g: 0, b: 255, a: 100 },
  },
  {
    minValue: 11,
    maxValue: 20,
    color: { r: 0, g: 255, b: 0, a: 100 },
  },
  {
    minValue: 21,
    maxValue: 25,
    color: { r: 255, g: 0, b: 0, a: 100 },
  },
];

const NewContourFormatPlaceholder = styled('div')`
  position: relative;
  width: calc(100% - ${({ theme }) => theme.sizeUnit}px);
  bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  left: 0;
`;

const ColorBreakpointsControl = ({
  onChange,
  ...props
}: ColorBreakpointsControlProps) => {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [colorBreakpoints, setColorBreakpoints] = useState<
    ColorBreakpointType[]
  >(props?.value ? props?.value : DEFAULT_COLOR_BREAKPOINTS);

  useEffect(() => {
    onChange?.(colorBreakpoints);
  }, [colorBreakpoints, onChange]);

  const togglePopover = (visible: boolean) => {
    setPopoverVisible(visible);
  };

  const handleClickGhostButton = () => {
    togglePopover(true);
  };

  const saveContour = (contour: ColorBreakpointType) => {
    setColorBreakpoints([...colorBreakpoints, contour]);
    togglePopover(false);
  };

  const removeContour = (index: number) => {
    const newContours = [...colorBreakpoints];
    newContours.splice(index, 1);
    setColorBreakpoints(newContours);
  };

  const onShiftContour = (hoverIndex: number, dragIndex: number) => {
    const newContours = [...colorBreakpoints];
    [newContours[hoverIndex], newContours[dragIndex]] = [
      newContours[dragIndex],
      newContours[hoverIndex],
    ];
    setColorBreakpoints(newContours);
  };

  const editContour = (contour: ColorBreakpointType, index: number) => {
    const newContours = [...colorBreakpoints];
    newContours[index] = contour;
    setColorBreakpoints(newContours);
  };

  const valuesRenderer = () =>
    colorBreakpoints.map((contour, index) => (
      <ColorBreakpointOption
        key={index}
        saveGradientBreakpoint={(newContour: ColorBreakpointType) =>
          editContour(newContour, index)
        }
        gradientBreakpoint={contour}
        index={index}
        onClose={removeContour}
        onShift={onShiftContour}
      />
    ));

  const ghostButtonText = t('Click to add new color');

  return (
    <>
      <DndSelectLabel
        onDrop={() => {}}
        canDrop={() => true}
        valuesRenderer={valuesRenderer}
        accept={[]}
        ghostButtonText={ghostButtonText}
        onClickGhostButton={handleClickGhostButton}
        {...props}
      />
      <ColorBreakpointsPopoverTrigger
        saveColorBreakpoint={saveContour}
        isControlled
        visible={popoverVisible}
        toggleVisibility={setPopoverVisible}
      >
        <NewContourFormatPlaceholder />
      </ColorBreakpointsPopoverTrigger>
    </>
  );
};

export default ColorBreakpointsControl;
