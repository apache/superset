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

import React, { useState, useEffect } from 'react';
import { styled, t } from '@superset-ui/core';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import ContourPopoverTrigger from './ContourPopoverTrigger';
import ContourOption from './ContourOption';
import { ContourType, ContourControlProps } from './types';

const DEFAULT_CONTOURS: ContourType[] = [
  {
    lowerThreshold: 4,
    color: { r: 255, g: 0, b: 255, a: 100 },
    strokeWidth: 1,
    zIndex: 0,
  },
  {
    lowerThreshold: 5,
    color: { r: 0, g: 255, b: 0, a: 100 },
    strokeWidth: 2,
    zIndex: 1,
  },
  {
    lowerThreshold: 6,
    upperThreshold: 10,
    color: { r: 0, g: 0, b: 255, a: 100 },
    zIndex: 2,
  },
];

const NewContourFormatPlaceholder = styled('div')`
  position: relative;
  width: calc(100% - ${({ theme }) => theme.gridUnit}px);
  bottom: ${({ theme }) => theme.gridUnit * 4}px;
  left: 0;
`;

const ContourControl = ({ onChange, ...props }: ContourControlProps) => {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [contours, setContours] = useState<ContourType[]>(
    props?.value ? props?.value : DEFAULT_CONTOURS,
  );

  useEffect(() => {
    // add z-index to contours
    const newContours = contours.map((contour, index) => ({
      ...contour,
      zIndex: (index + 1) * 10,
    }));
    onChange?.(newContours);
  }, [onChange, contours]);

  const togglePopover = (visible: boolean) => {
    setPopoverVisible(visible);
  };

  const handleClickGhostButton = () => {
    togglePopover(true);
  };

  const saveContour = (contour: ContourType) => {
    setContours([...contours, contour]);
    togglePopover(false);
  };

  const removeContour = (index: number) => {
    const newContours = [...contours];
    newContours.splice(index, 1);
    setContours(newContours);
  };

  const onShiftContour = (hoverIndex: number, dragIndex: number) => {
    const newContours = [...contours];
    [newContours[hoverIndex], newContours[dragIndex]] = [
      newContours[dragIndex],
      newContours[hoverIndex],
    ];
    setContours(newContours);
  };

  const editContour = (contour: ContourType, index: number) => {
    const newContours = [...contours];
    newContours[index] = contour;
    setContours(newContours);
  };

  const valuesRenderer = () =>
    contours.map((contour, index) => (
      <ContourOption
        key={index}
        saveContour={(newContour: ContourType) =>
          editContour(newContour, index)
        }
        contour={contour}
        index={index}
        onClose={removeContour}
        onShift={onShiftContour}
      />
    ));

  const ghostButtonText = t('Click to add a contour');

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
      <ContourPopoverTrigger
        saveContour={saveContour}
        isControlled
        visible={popoverVisible}
        toggleVisibility={setPopoverVisible}
      >
        <NewContourFormatPlaceholder />
      </ContourPopoverTrigger>
    </>
  );
};

export default ContourControl;
