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
import GradientBreakpointOption from './GradientBreakpointOption';
import {
  GradientBreakpointType,
  GradientBreakpointsControlProps,
} from './types';
import GradientBreakpointsPopoverTrigger from './GradientBreakpointsPopoverTrigger';

const DEFAULT_GRADIENT_BREAKPOINTS: GradientBreakpointType[] = [
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

const GradientBreakpointsControl = ({
  onChange,
  ...props
}: GradientBreakpointsControlProps) => {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [gradientBreakpoints, setGradientBreakpoints] = useState<
    GradientBreakpointType[]
  >(props?.value ? props?.value : DEFAULT_GRADIENT_BREAKPOINTS);

  useEffect(() => {
    // add z-index to contours
    const newContours = gradientBreakpoints.map((contour, index) => ({
      ...contour,
      zIndex: (index + 1) * 10,
    }));
    onChange?.(newContours);
  }, [onChange, gradientBreakpoints]);

  const togglePopover = (visible: boolean) => {
    setPopoverVisible(visible);
  };

  const handleClickGhostButton = () => {
    togglePopover(true);
  };

  const saveContour = (contour: GradientBreakpointType) => {
    setGradientBreakpoints([...gradientBreakpoints, contour]);
    togglePopover(false);
  };

  const removeContour = (index: number) => {
    const newContours = [...gradientBreakpoints];
    newContours.splice(index, 1);
    setGradientBreakpoints(newContours);
  };

  const onShiftContour = (hoverIndex: number, dragIndex: number) => {
    const newContours = [...gradientBreakpoints];
    [newContours[hoverIndex], newContours[dragIndex]] = [
      newContours[dragIndex],
      newContours[hoverIndex],
    ];
    setGradientBreakpoints(newContours);
  };

  const editContour = (contour: GradientBreakpointType, index: number) => {
    const newContours = [...gradientBreakpoints];
    newContours[index] = contour;
    setGradientBreakpoints(newContours);
  };

  const valuesRenderer = () =>
    gradientBreakpoints.map((contour, index) => (
      <GradientBreakpointOption
        key={index}
        saveGradientBreakpoint={(newContour: GradientBreakpointType) =>
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
      <GradientBreakpointsPopoverTrigger
        saveGradientBreakpoint={saveContour}
        isControlled
        visible={popoverVisible}
        toggleVisibility={setPopoverVisible}
      >
        <NewContourFormatPlaceholder />
      </GradientBreakpointsPopoverTrigger>
    </>
  );
};

export default GradientBreakpointsControl;
