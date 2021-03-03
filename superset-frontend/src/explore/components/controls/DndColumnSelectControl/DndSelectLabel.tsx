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
import React from 'react';
import { useDrop } from 'react-dnd';
import { isEmpty } from 'lodash';
import { t, useTheme } from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  AddControlLabel,
  DndLabelsContainer,
  HeaderContainer,
} from 'src/explore/components/OptionControls';
import { DatasourcePanelDndItem } from 'src/explore/components/DatasourcePanel/types';
import Icon from 'src/components/Icon';
import { DndColumnSelectProps } from './types';

export default function DndSelectLabel<T, O>(
  props: DndColumnSelectProps<T, O>,
) {
  const theme = useTheme();

  const [{ isOver, canDrop }, datasourcePanelDrop] = useDrop({
    accept: props.accept,

    drop: (item: DatasourcePanelDndItem) => {
      props.onDrop(item);
    },

    canDrop: (item: DatasourcePanelDndItem) => props.canDrop(item),

    collect: monitor => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
      type: monitor.getItemType(),
    }),
  });

  function renderPlaceHolder() {
    return (
      <AddControlLabel cancelHover>
        <Icon name="plus-small" color={theme.colors.grayscale.light1} />
        {t('Drop Columns')}
      </AddControlLabel>
    );
  }

  return (
    <div ref={datasourcePanelDrop}>
      <HeaderContainer>
        <ControlHeader {...props} />
      </HeaderContainer>
      <DndLabelsContainer canDrop={canDrop} isOver={isOver}>
        {isEmpty(props.values) ? renderPlaceHolder() : props.valuesRenderer()}
      </DndLabelsContainer>
    </div>
  );
}
