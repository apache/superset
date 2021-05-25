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
import { tn } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';
import { LabelProps } from 'src/explore/components/controls/DndColumnSelectControl/types';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import OptionWrapper from 'src/explore/components/controls/DndColumnSelectControl/OptionWrapper';
import { OptionSelector } from 'src/explore/components/controls/DndColumnSelectControl/utils';
import { DatasourcePanelDndItem } from 'src/explore/components/DatasourcePanel/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import { StyledColumnOption } from 'src/explore/components/optionRenderers';

export const DndColumnSelect = (props: LabelProps) => {
  const { value, options, multi = true } = props;
  const optionSelector = new OptionSelector(options, value);
  const [values, setValues] = useState<ColumnMeta[]>(optionSelector.values);

  const onDrop = (item: DatasourcePanelDndItem) => {
    const column = item.value as ColumnMeta;
    if (!optionSelector.isArray && !isEmpty(optionSelector.values)) {
      optionSelector.replace(0, column.column_name);
    } else {
      optionSelector.add(column.column_name);
    }
    setValues(optionSelector.values);
    props.onChange(optionSelector.getValues());
  };

  const canDrop = (item: DatasourcePanelDndItem) =>
    (multi || optionSelector.values.length === 0) &&
    !optionSelector.has((item.value as ColumnMeta).column_name);

  const onClickClose = (index: number) => {
    optionSelector.del(index);
    setValues(optionSelector.values);
    props.onChange(optionSelector.getValues());
  };

  const onShiftOptions = (dragIndex: number, hoverIndex: number) => {
    optionSelector.swap(dragIndex, hoverIndex);
    setValues(optionSelector.values);
    props.onChange(optionSelector.getValues());
  };

  const valuesRenderer = () =>
    values.map((column, idx) => (
      <OptionWrapper
        key={idx}
        index={idx}
        clickClose={onClickClose}
        onShiftOptions={onShiftOptions}
        type={DndItemType.ColumnOption}
      >
        <StyledColumnOption column={column} showType />
      </OptionWrapper>
    ));

  return (
    <DndSelectLabel<string | string[], ColumnMeta[]>
      onDrop={onDrop}
      canDrop={canDrop}
      valuesRenderer={valuesRenderer}
      accept={DndItemType.Column}
      displayGhostButton={multi || optionSelector.values.length === 0}
      ghostButtonText={tn('Drop column', 'Drop columns', multi ? 2 : 1)}
      {...props}
    />
  );
};
