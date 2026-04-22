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
import { RefObject, useMemo } from 'react';
import { useDrag } from 'react-dnd';
import { useSelector } from 'react-redux';
import { Metric } from '@superset-ui/core';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { DndItemType } from 'src/explore/components/DndItemType';
import {
  StyledColumnOption,
  StyledMetricOption,
} from 'src/explore/components/optionRenderers';
import { Icons } from '@superset-ui/core/components/Icons';
import { ExplorePageState } from 'src/explore/types';

import { DatasourcePanelDndItem } from '../types';

const DatasourceItemContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: ${theme.sizeUnit * 6}px;
    padding: 0 ${theme.sizeUnit}px;

    // hack to make the drag preview image corners rounded
    transform: translate(0, 0);
    color: ${theme.colorText};
    background-color: ${theme.colorBgLayout};
    border-radius: 4px;

    &:hover {
      background-color: ${theme.colorPrimaryBgHover};
    }

    > div {
      min-width: 0;
      margin-right: ${theme.sizeUnit * 2}px;
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
  const theme = useTheme();

  // Read compatibility lists from Redux.
  // `null` means no filtering is active (SQL datasets, or no selection yet).
  const compatibleMetrics = useSelector<
    ExplorePageState,
    string[] | null | undefined
  >(state => state.explore.compatibleMetrics);
  const compatibleDimensions = useSelector<
    ExplorePageState,
    string[] | null | undefined
  >(state => state.explore.compatibleDimensions);

  // An item is compatible when the list is null (no filter) or when its
  // name explicitly appears in the list returned by the backend.
  const isCompatible = useMemo(() => {
    if (type === DndItemType.Metric) {
      if (!compatibleMetrics) return true;
      return compatibleMetrics.includes((value as Metric).metric_name);
    }
    if (type === DndItemType.Column) {
      if (!compatibleDimensions) return true;
      return compatibleDimensions.includes(
        (value as ColumnMeta).column_name,
      );
    }
    return true;
  }, [type, value, compatibleMetrics, compatibleDimensions]);

  const [{ isDragging }, drag] = useDrag({
    item: {
      value: props.value,
      type: props.type,
    },
    canDrag: isCompatible,
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
    <DatasourceItemContainer
      data-test="DatasourcePanelDragOption"
      ref={drag}
      style={{
        opacity: isCompatible ? 1 : 0.35,
        cursor: isCompatible ? 'grab' : 'not-allowed',
      }}
    >
      {type === DndItemType.Column ? (
        <StyledColumnOption column={value as ColumnMeta} {...optionProps} />
      ) : (
        <StyledMetricOption metric={value as MetricOption} {...optionProps} />
      )}
      <Icons.Drag
        iconSize="xl"
        css={css`
          color: ${theme.colorFill};
          &hover {
            color: ${theme.colorIcon};
          }
        `}
      />
    </DatasourceItemContainer>
  );
}
