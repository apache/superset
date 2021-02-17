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
import { t, withTheme, SupersetTheme } from '@superset-ui/core';
import { BaseControlConfig, ColumnMeta } from '@superset-ui/chart-controls';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  AddControlLabel,
  HeaderContainer,
  LabelsContainer,
} from 'src/explore/components/OptionControls';
import {
  DatasourcePanelDndType,
  DatasourcePanelDndItem,
} from 'src/explore/components/DatasourcePanel/types';
import Icon from 'src/components/Icon';
import OptionWrapper from './components/OptionWrapper';
import { getOptionsFromGroupByValues } from './utils';

interface DropGroupByControlProps extends BaseControlConfig {
  name: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: { string: ColumnMeta };
  theme: SupersetTheme;
}

function DropGroupByControl(props: DropGroupByControlProps) {
  const { value: groupByValues, options } = props;
  const [groupByOptions, setGroupByOptions] = useState<ColumnMeta[]>(
    getOptionsFromGroupByValues(options, groupByValues),
  );

  const [, datasourcePanelDrop] = useDrop({
    accept: DatasourcePanelDndType.COLUMN,

    drop: (item: DatasourcePanelDndItem) => {
      const newGroupByValues = groupByValues.concat([item.metricOrColumnName]);
      setGroupByOptions(getOptionsFromGroupByValues(options, newGroupByValues));
      props.onChange(newGroupByValues);
    },

    canDrop: (item: DatasourcePanelDndItem) =>
      !groupByValues.includes(item.metricOrColumnName),

    collect: monitor => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  function onClickClose(columnName: string) {
    const newGroupByValues = groupByValues.filter(
      value => value !== columnName,
    );
    setGroupByOptions(getOptionsFromGroupByValues(options, newGroupByValues));
    props.onChange(newGroupByValues);
  }

  function onShiftOptions(dragIndex: number, dropIndex: number) {
    const val = [...groupByValues];
    [val[dropIndex], val[dragIndex]] = [val[dragIndex], val[dropIndex]];
    setGroupByOptions(getOptionsFromGroupByValues(options, val));
    props.onChange(val);
  }

  const PlaceHolderRenderer = () => (
    <AddControlLabel cancelHover>
      <Icon name="plus-small" color={props.theme.colors.grayscale.light1} />
      {t('Drop Columns')}
    </AddControlLabel>
  );

  const OptionsRenderer = () => (
    <>
      {groupByOptions.map(column => (
        <OptionWrapper
          key={column.column_name}
          column={column}
          index={groupByOptions.indexOf(column)}
          clickClose={onClickClose}
          onShiftOptions={onShiftOptions}
        />
      ))}
    </>
  );

  return (
    <>
      <div ref={datasourcePanelDrop}>
        <HeaderContainer>
          <ControlHeader {...props} />
        </HeaderContainer>
        <LabelsContainer>
          {isEmpty(groupByOptions) ? (
            <PlaceHolderRenderer />
          ) : (
            <OptionsRenderer />
          )}
        </LabelsContainer>
      </div>
    </>
  );
}

export default withTheme(DropGroupByControl);
