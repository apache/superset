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
import { RefObject } from 'react';
import { useDrag } from 'react-dnd';
import { css, Metric, styled } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { DndItemType } from 'src/explore/components/DndItemType';
import {
  StyledColumnOption,
  StyledMetricOption,
} from 'src/explore/components/optionRenderers';
import Icons from 'src/components/Icons';

import { DatasourcePanelDndItem } from '../types';

const DatasourceItemContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: ${theme.gridUnit * 6}px;
    padding: 0 ${theme.gridUnit}px;

    // hack to make the drag preview image corners rounded
    transform: translate(0, 0);
    background-color: inherit;
    border-radius: 4px;

    > div {
      min-width: 0;
      margin-right: ${theme.gridUnit * 2}px;
    }
  `}
`;

interface DatasourcePanelDragOptionProps extends DatasourcePanelDndItem {
  labelRef?: RefObject<any>;
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
      <Icons.Drag />
    </DatasourceItemContainer>
  );
}
