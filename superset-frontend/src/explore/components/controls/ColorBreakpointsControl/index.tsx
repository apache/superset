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
import { styled, t } from '@superset-ui/core';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import ColorBreakpointOption from './ColorBreakpointOption';
import { ColorBreakpointType, ColorBreakpointsControlProps } from './types';
import ColorBreakpointPopoverTrigger from './ColorBreakpointPopoverTrigger';

const DEFAULT_COLOR_BREAKPOINTS: ColorBreakpointType[] = [];

const NewColorBreakpointFormatPlaceholder = styled('div')`
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

  const saveColorBreakpoint = (breakpoint: ColorBreakpointType) => {
    setColorBreakpoints([
      ...colorBreakpoints,
      {
        ...breakpoint,
        id: colorBreakpoints.length,
      },
    ]);
    togglePopover(false);
  };

  const removeColorBreakpoint = (index: number) => {
    const newBreakpoints = [...colorBreakpoints];
    newBreakpoints.splice(index, 1);
    setColorBreakpoints(newBreakpoints);
  };

  const editColorBreakpoint = (
    breakpoint: ColorBreakpointType,
    index: number,
  ) => {
    const newBreakpoints = [...colorBreakpoints];
    newBreakpoints[index] = {
      ...breakpoint,
      id: index,
    };
    setColorBreakpoints(newBreakpoints);
  };

  const valuesRenderer = () =>
    colorBreakpoints.map((breakpoint, index) => (
      <ColorBreakpointOption
        key={index}
        saveColorBreakpoint={(newBreakpoint: ColorBreakpointType) =>
          editColorBreakpoint(newBreakpoint, index)
        }
        breakpoint={breakpoint}
        colorBreakpoints={colorBreakpoints}
        index={index}
        onClose={removeColorBreakpoint}
        onShift={() => {}}
      />
    ));

  const ghostButtonText = t('Click to add new breakpoint');

  return (
    <>
      <DndSelectLabel
        onDrop={() => {}}
        canDrop={() => false}
        valuesRenderer={valuesRenderer}
        accept={[]}
        ghostButtonText={ghostButtonText}
        onClickGhostButton={handleClickGhostButton}
        {...props}
      />
      <ColorBreakpointPopoverTrigger
        saveColorBreakpoint={saveColorBreakpoint}
        colorBreakpoints={colorBreakpoints}
        isControlled
        visible={popoverVisible}
        toggleVisibility={setPopoverVisible}
      >
        <NewColorBreakpointFormatPlaceholder />
      </ColorBreakpointPopoverTrigger>
    </>
  );
};

export default ColorBreakpointsControl;
