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
import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import { isEmpty } from 'lodash';
import { t, useTheme } from '@superset-ui/core';
import { BaseControlConfig, ColumnMeta } from '@superset-ui/chart-controls';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  AddControlLabel,
  DndLabelsContainer,
  HeaderContainer,
} from 'src/explore/components/OptionControls';
import {
  DatasourcePanelDndItem,
  DatasourcePanelDndType,
} from 'src/explore/components/DatasourcePanel/types';
import Icon from 'src/components/Icon';
import OptionWrapper from './components/OptionWrapper';
import { OptionSelector } from './utils';

interface LabelProps extends BaseControlConfig {
  name: string;
  value: string[] | string | null;
  onChange: (value: string[] | string | null) => void;
  options: { string: ColumnMeta };
}

export default function DndColumnSelectLabel(props: LabelProps) {
  const theme = useTheme();
  const { value, options } = props;
  const optionSelector = new OptionSelector(options, value);
  const [groupByOptions, setGroupByOptions] = useState<ColumnMeta[]>(
    optionSelector.groupByOptions,
  );

  const [{ isOver, canDrop }, datasourcePanelDrop] = useDrop({
    accept: DatasourcePanelDndType.COLUMN,

    drop: (item: DatasourcePanelDndItem) => {
      if (!optionSelector.isArray && !isEmpty(optionSelector.groupByOptions)) {
        optionSelector.replace(0, item.metricOrColumnName);
      } else {
        optionSelector.add(item.metricOrColumnName);
      }
      setGroupByOptions(optionSelector.groupByOptions);
      props.onChange(optionSelector.getValues());
    },

    canDrop: (item: DatasourcePanelDndItem) =>
      !optionSelector.has(item.metricOrColumnName),

    collect: monitor => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
      type: monitor.getItemType(),
    }),
  });

  function onClickClose(index: number) {
    optionSelector.del(index);
    setGroupByOptions(optionSelector.groupByOptions);
    props.onChange(optionSelector.getValues());
  }

  function onShiftOptions(dragIndex: number, hoverIndex: number) {
    optionSelector.swap(dragIndex, hoverIndex);
    setGroupByOptions(optionSelector.groupByOptions);
    props.onChange(optionSelector.getValues());
  }

  function renderPlaceHolder() {
    return (
      <AddControlLabel cancelHover>
        <Icon name="plus-small" color={theme.colors.grayscale.light1} />
        {t('Drop Columns')}
      </AddControlLabel>
    );
  }

  function renderOptions() {
    return groupByOptions.map((column, idx) => (
      <OptionWrapper
        key={idx}
        index={idx}
        column={column}
        clickClose={onClickClose}
        onShiftOptions={onShiftOptions}
      />
    ));
  }

  return (
    <div ref={datasourcePanelDrop}>
      <HeaderContainer>
        <ControlHeader {...props} />
      </HeaderContainer>
      <DndLabelsContainer canDrop={canDrop} isOver={isOver}>
        {isEmpty(groupByOptions) ? renderPlaceHolder() : renderOptions()}
      </DndLabelsContainer>
    </div>
  );
}
