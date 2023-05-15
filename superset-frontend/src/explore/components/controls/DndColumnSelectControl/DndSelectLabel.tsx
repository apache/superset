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
import React, { ReactNode, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { t, useTheme } from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  AddControlLabel,
  DndLabelsContainer,
  HeaderContainer,
} from 'src/explore/components/controls/OptionControls';
import {
  DatasourcePanelDndItem,
  DndItemValue,
} from 'src/explore/components/DatasourcePanel/types';
import Icons from 'src/components/Icons';
import { DndItemType } from '../../DndItemType';

export type DndSelectLabelProps = {
  name: string;
  accept: DndItemType | DndItemType[];
  ghostButtonText: string;
  onDrop: (item: DatasourcePanelDndItem) => void;
  canDrop: (item: DatasourcePanelDndItem) => boolean;
  canDropValue?: (value: DndItemValue) => boolean;
  onDropValue?: (value: DndItemValue) => void;
  valuesRenderer: () => ReactNode;
  displayGhostButton?: boolean;
  onClickGhostButton: () => void;
};

export default function DndSelectLabel({
  displayGhostButton = true,
  accept,
  valuesRenderer,
  ...props
}: DndSelectLabelProps) {
  const theme = useTheme();

  const [{ isOver, canDrop }, datasourcePanelDrop] = useDrop({
    accept,

    drop: (item: DatasourcePanelDndItem) => {
      props.onDrop(item);
      props.onDropValue?.(item.value);
    },

    canDrop: (item: DatasourcePanelDndItem) =>
      props.canDrop(item) && (props.canDropValue?.(item.value) ?? true),

    collect: monitor => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
      type: monitor.getItemType(),
    }),
  });

  const values = useMemo(() => valuesRenderer(), [valuesRenderer]);

  function renderGhostButton() {
    return (
      <AddControlLabel
        cancelHover={!props.onClickGhostButton}
        onClick={props.onClickGhostButton}
      >
        <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
        {t(props.ghostButtonText)}
      </AddControlLabel>
    );
  }

  return (
    <div ref={datasourcePanelDrop}>
      <HeaderContainer>
        <ControlHeader {...props} />
      </HeaderContainer>
      <DndLabelsContainer
        data-test="dnd-labels-container"
        canDrop={canDrop}
        isOver={isOver}
      >
        {values}
        {displayGhostButton && renderGhostButton()}
      </DndLabelsContainer>
    </div>
  );
}
