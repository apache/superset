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
import { useDrag } from 'react-dnd';
import { Metric, styled } from '@superset-ui/core';
import { DndItemType } from 'src/explore/components/DndItemType';
import {
  StyledColumnOption,
  StyledMetricOption,
} from 'src/explore/components/optionRenderers';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { DatasourcePanelDndItem } from '../types';

const DatasourceItemContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${({ theme }) => theme.gridUnit * 6}px;
  cursor: pointer;

  > div {
    width: 100%;
  }

  :hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light2};
  }
`;

interface DatasourcePanelDragOptionProps extends DatasourcePanelDndItem {
  labelRef?: React.RefObject<any>;
  showTooltip?: boolean;
}

type MetricOption = Omit<Metric, 'id'> & {
  label?: string;
};

export default function DatasourcePanelDragOption(
  props: DatasourcePanelDragOptionProps,
) {
  const { labelRef, showTooltip, type, value } = props;
  const [{ isDragging }, drag] = useDrag({
    item: {
      value: props.value,
      type: props.type,
    },
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const optionProps = {
    labelRef,
    showTooltip: !isDragging && showTooltip,
    showType: true,
  };

  return (
    <DatasourceItemContainer data-test="DatasourcePanelDragOption" ref={drag}>
      {type === DndItemType.Column ? (
        <StyledColumnOption column={value as ColumnMeta} {...optionProps} />
      ) : (
        <StyledMetricOption metric={value as MetricOption} {...optionProps} />
      )}
    </DatasourceItemContainer>
  );
}
