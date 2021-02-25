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
import { ColumnOption, ColumnMeta } from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';
import { GroupByItemType, LabelProps } from './types';
import DndColumnSelectLabel from './DndColumnSelectLabel';
import OptionWrapper from './components/OptionWrapper';
import { OptionSelector } from './utils';
import { DatasourcePanelDndItem } from '../../DatasourcePanel/types';

export const LabelColumnSelect = (props: LabelProps) => {
  const { value, options } = props;
  const optionSelector = new OptionSelector(options, value);
  const [values, setValues] = useState<ColumnMeta[]>(optionSelector.values);

  const onDrop = (item: DatasourcePanelDndItem) => {
    if (!optionSelector.isArray && !isEmpty(optionSelector.values)) {
      optionSelector.replace(0, item.metricOrColumnName);
    } else {
      optionSelector.add(item.metricOrColumnName);
    }
    setValues(optionSelector.values);
    props.onChange(optionSelector.getValues());
  };

  const canDrop = (item: DatasourcePanelDndItem) =>
    !optionSelector.has(item.metricOrColumnName);

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
        type={GroupByItemType}
      >
        <ColumnOption column={column} showType />
      </OptionWrapper>
    ));

  return (
    <DndColumnSelectLabel
      values={values}
      onDrop={onDrop}
      canDrop={canDrop}
      valuesRenderer={valuesRenderer}
      {...props}
    />
  );
};
