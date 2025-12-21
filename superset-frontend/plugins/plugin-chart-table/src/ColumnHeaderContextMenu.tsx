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
import { useCallback, useMemo } from 'react';
import { t, ensureIsArray, HandlerFunction } from '@superset-ui/core';
import { css } from '@apache-superset/core/ui';
import { Dropdown, Menu } from '@superset-ui/core/components';
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  GroupOutlined,
  CalculatorOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { DataColumnMeta, TableChartFormData } from './types';

export interface ColumnHeaderContextMenuProps {
  column: DataColumnMeta;
  formData?: TableChartFormData;
  setControlValue?: HandlerFunction;
  children: React.ReactNode;
  disabled?: boolean;
}

type MenuAction =
  | 'groupby'
  | 'sum'
  | 'avg'
  | 'count'
  | 'count_distinct'
  | 'min'
  | 'max'
  | 'hide';

export default function ColumnHeaderContextMenu({
  column,
  formData,
  setControlValue,
  children,
  disabled = false,
}: ColumnHeaderContextMenuProps) {
  const isNumericColumn =
    column.dataType === GenericDataType.Numeric || column.isNumeric;
  const isMetric = column.isMetric || column.isPercentMetric;
  const columnName = column.key;

  const handleMenuClick = useCallback(
    (action: MenuAction) => {
      if (!setControlValue || !formData) return;

      const currentGroupby = ensureIsArray(formData.groupby);
      const currentMetrics = ensureIsArray(formData.metrics);

      switch (action) {
        case 'groupby':
          // Add column to groupby if not already present
          if (!currentGroupby.includes(columnName)) {
            setControlValue('groupby', [...currentGroupby, columnName]);
          }
          break;

        case 'sum':
        case 'avg':
        case 'count':
        case 'min':
        case 'max': {
          // Create an aggregate metric
          const aggregate = action.toUpperCase();
          const metricLabel = `${aggregate}(${columnName})`;
          const newMetric = {
            aggregate,
            column: { column_name: columnName },
            expressionType: 'SIMPLE',
            label: metricLabel,
          };
          setControlValue('metrics', [...currentMetrics, newMetric]);
          break;
        }

        case 'count_distinct': {
          const metricLabel = `COUNT_DISTINCT(${columnName})`;
          const newMetric = {
            aggregate: 'COUNT_DISTINCT',
            column: { column_name: columnName },
            expressionType: 'SIMPLE',
            label: metricLabel,
          };
          setControlValue('metrics', [...currentMetrics, newMetric]);
          break;
        }

        case 'hide': {
          // Update column_config to hide this column
          const currentColumnConfig = formData.column_config || {};
          setControlValue('column_config', {
            ...currentColumnConfig,
            [columnName]: {
              ...currentColumnConfig[columnName],
              visible: false,
            },
          });
          break;
        }

        default:
          break;
      }
    },
    [setControlValue, formData, columnName],
  );

  const menuItems = useMemo(() => {
    const items: React.ComponentProps<typeof Menu>['items'] = [];

    // Group By option (only for non-metric columns)
    if (!isMetric) {
      items.push({
        key: 'groupby',
        icon: <GroupOutlined />,
        label: t('Group by this column'),
        onClick: () => handleMenuClick('groupby'),
      });
    }

    // Aggregate options (for numeric columns or any column for COUNT)
    if (!isMetric) {
      const aggregateItems = [
        {
          key: 'count',
          label: t('COUNT'),
          onClick: () => handleMenuClick('count'),
        },
        {
          key: 'count_distinct',
          label: t('COUNT DISTINCT'),
          onClick: () => handleMenuClick('count_distinct'),
        },
      ];

      if (isNumericColumn) {
        aggregateItems.unshift(
          {
            key: 'sum',
            label: t('SUM'),
            onClick: () => handleMenuClick('sum'),
          },
          {
            key: 'avg',
            label: t('AVG'),
            onClick: () => handleMenuClick('avg'),
          },
          {
            key: 'min',
            label: t('MIN'),
            onClick: () => handleMenuClick('min'),
          },
          {
            key: 'max',
            label: t('MAX'),
            onClick: () => handleMenuClick('max'),
          },
        );
      }

      items.push({
        key: 'aggregate',
        icon: <CalculatorOutlined />,
        label: t('Add as metric'),
        children: aggregateItems,
      });
    }

    // Divider
    if (items.length > 0) {
      items.push({ type: 'divider' });
    }

    // Hide column
    items.push({
      key: 'hide',
      icon: <EyeInvisibleOutlined />,
      label: t('Hide column'),
      onClick: () => handleMenuClick('hide'),
    });

    return items;
  }, [isMetric, isNumericColumn, handleMenuClick]);

  // If no setControlValue, just render children without dropdown
  if (!setControlValue || disabled) {
    return <>{children}</>;
  }

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['contextMenu']}
      overlayStyle={{ minWidth: 180 }}
    >
      <span
        css={css`
          cursor: context-menu;
        `}
      >
        {children}
      </span>
    </Dropdown>
  );
}
