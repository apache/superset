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
  DatasourcePanelDndItemInterface,
} from 'src/explore/components/DatasourcePanel/types';
import Icon from 'src/components/Icon';
import OptionWrapper from './components/OptionWrapper';

interface DropGroupByControlProps extends BaseControlConfig {
  name: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: { string: ColumnMeta };
  theme: SupersetTheme;
}

function DropGroupByControl(props: DropGroupByControlProps) {
  const [groupByValues, setGroupByValues] = useState<string[]>(props.value ?? [])
  const [, datasourcePanelDrop] = useDrop({
    accept: DatasourcePanelDndType.COLUMN,
    drop: (item: DatasourcePanelDndItemInterface) => {
      if (!groupByValues.includes(item.metricOrColumnName)) {
        const newValue = groupByValues.concat([item.metricOrColumnName]);
        setGroupByValues(newValue);
        props.onChange(newValue);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })

  const dbColumnsInCurrentControl: ColumnMeta[] = [];
  groupByValues.forEach((value) => {
    if (value in props.options) {
      dbColumnsInCurrentControl.push(props.options[value]);
    }
  });

  const onClickClose = (columnName: string) => {
    const newGroupByValues = groupByValues.filter((value) => value !== columnName)
    setGroupByValues(newGroupByValues);
    props.onChange(newGroupByValues);
  }

  const PlaceHolderRenderer = () =>
    <AddControlLabel cancelHover>
      <Icon
        name="plus-small"
        color={props.theme.colors.grayscale.light1}
      />
      {t('Drop Columns')}
    </AddControlLabel>

  const OptionsRenderer = () => {
    return (
      <>
        {dbColumnsInCurrentControl.map((column) =>
          <OptionWrapper
            key={column.column_name}
            column={column}
            clickClose={onClickClose}
          />)}
      </>
    )
  }

  return (
    <>
      <div ref={datasourcePanelDrop}>
        <HeaderContainer>
          <ControlHeader {...props} />
        </HeaderContainer>
        <LabelsContainer>
          { isEmpty(dbColumnsInCurrentControl) ? <PlaceHolderRenderer /> : <OptionsRenderer /> }
        </LabelsContainer>
      </div>
    </>
  );
}

export default withTheme(DropGroupByControl);
