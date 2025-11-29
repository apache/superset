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

import { useCallback, useEffect, useState } from 'react';
import { t } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  AddControlLabel,
  HeaderContainer,
  LabelsContainer,
  OptionControlLabel,
  DragContainer,
} from '../OptionControls';
import { ChartColumnPopover } from './ChartColumnPopover';
import { ChartColumnsControlProps, ChartColumnConfig } from './types';

const CHART_COLUMN_DND_TYPE = 'ChartColumn';

const ChartColumnsControl = ({
  value,
  onChange,
  ...props
}: ChartColumnsControlProps) => {
  const [chartColumns, setChartColumns] = useState<ChartColumnConfig[]>(
    value ?? [],
  );

  useEffect(() => {
    if (onChange) {
      onChange(chartColumns);
    }
  }, [chartColumns, onChange]);

  const onDelete = useCallback((index: number) => {
    setChartColumns(prevColumns => prevColumns.filter((_, i) => i !== index));
  }, []);

  const onAdd = useCallback((config: ChartColumnConfig) => {
    setChartColumns(prevColumns => [...prevColumns, config]);
  }, []);

  const onEdit = useCallback((newConfig: ChartColumnConfig, index: number) => {
    setChartColumns(prevColumns => {
      const newColumns = [...prevColumns];
      newColumns.splice(index, 1, newConfig);
      return newColumns;
    });
  }, []);

  const moveLabel = useCallback((dragIndex: number, hoverIndex: number) => {
    setChartColumns(prevColumns => {
      const newColumns = [...prevColumns];
      [newColumns[hoverIndex], newColumns[dragIndex]] = [
        newColumns[dragIndex],
        newColumns[hoverIndex],
      ];
      return newColumns;
    });
  }, []);

  const onDropLabel = useCallback(() => {
    if (onChange) {
      onChange(chartColumns);
    }
  }, [chartColumns, onChange]);

  return (
    <div>
      <HeaderContainer>
        <ControlHeader {...props} />
      </HeaderContainer>
      <LabelsContainer>
        {chartColumns.map((chartColumn, index) => (
          <DragContainer key={chartColumn.key}>
            <ChartColumnPopover
              title={t('Edit chart column')}
              config={chartColumn}
              onChange={config => onEdit(config, index)}
              destroyTooltipOnHide
            >
              <OptionControlLabel
                label={chartColumn.label}
                onRemove={() => onDelete(index)}
                onMoveLabel={moveLabel}
                onDropLabel={onDropLabel}
                index={index}
                type={CHART_COLUMN_DND_TYPE}
                withCaret
                multi
              />
            </ChartColumnPopover>
          </DragContainer>
        ))}
        <ChartColumnPopover
          title={t('Add new chart column')}
          onChange={onAdd}
          destroyOnHidden
        >
          <AddControlLabel>
            <Icons.PlusOutlined
              iconSize="m"
              css={theme => ({
                margin: `auto ${theme.sizeUnit}px auto 0`,
                verticalAlign: 'baseline',
              })}
            />
            {t('Add new chart column')}
          </AddControlLabel>
        </ChartColumnPopover>
      </LabelsContainer>
    </div>
  );
};

export default ChartColumnsControl;
