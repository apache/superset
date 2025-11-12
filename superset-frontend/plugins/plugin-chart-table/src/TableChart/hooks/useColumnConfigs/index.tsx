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
import {
  CSSProperties,
  useCallback,
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { ColumnWithLooseAccessor, Row } from 'react-table';
import cx from 'classnames';
import {
  DataRecord,
  DataRecordValue,
  getSelectedText,
  t,
} from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/ui';
import { Tooltip } from '@superset-ui/core/components';
import { InfoCircleOutlined } from '@ant-design/icons';
import { ColorFormatters } from '@superset-ui/chart-controls';
import { DataColumnMeta, ColorSchemeEnum } from '../../../types';
import { formatColumnValue } from '../../../utils/formatValue';
import DateWithFormatter from '../../../utils/DateWithFormatter';
import {
  cellWidth,
  cellOffset,
  cellBackground,
  getSortTypeByDataType,
} from '../../utils';
import { ACTION_KEYS, ValueRange } from '../../constants';

export interface UseColumnConfigsProps<D extends DataRecord> {
  defaultAlignPN: boolean;
  defaultColorPN: boolean;
  emitCrossFilters?: boolean;
  getValueRange: (
    key: string,
    alignPositiveNegative: boolean,
  ) => ValueRange | null;
  isActiveFilterValue: (key: string, val: DataRecordValue) => boolean;
  isRawRecords?: boolean;
  showCellBars: boolean;
  sortDesc: boolean;
  totals?: DataRecord;
  columnColorFormatters?: any[];
  allowRearrangeColumns?: boolean;
  allowRenderHtml?: boolean;
  basicColorColumnFormatters?: any[];
  basicColorFormatters?: any[];
  comparisonLabels: string[];
  getSharedStyle: (column: DataColumnMeta) => CSSProperties;
  groupHeaderColumns: Record<string, number[]>;
  handleContextMenu?: (
    value: D,
    cellPoint: { key: string; value: DataRecordValue; isMetric?: boolean },
    clientX: number,
    clientY: number,
  ) => void;
  handleToggleFilter: (key: string, val: DataRecordValue) => void;
  isUsingTimeComparison?: boolean;
  SortIcon: React.ComponentType<any>;
}

export function useColumnConfigs<D extends DataRecord = DataRecord>({
  defaultAlignPN,
  defaultColorPN,
  emitCrossFilters,
  getValueRange,
  isActiveFilterValue,
  isRawRecords,
  showCellBars,
  sortDesc,
  totals,
  columnColorFormatters,
  allowRearrangeColumns,
  allowRenderHtml,
  basicColorColumnFormatters,
  basicColorFormatters,
  comparisonLabels,
  getSharedStyle,
  groupHeaderColumns,
  handleContextMenu,
  handleToggleFilter,
  isUsingTimeComparison,
  SortIcon,
}: UseColumnConfigsProps<D>) {
  const theme = useTheme();

  const getColumnConfigs = useCallback(
    (
      column: DataColumnMeta,
      i: number,
    ): ColumnWithLooseAccessor<D> & {
      columnKey: string;
    } => {
      const {
        key,
        label: originalLabel,
        dataType,
        isMetric,
        isPercentMetric,
        config = {},
      } = column;
      const label = config.customColumnName || originalLabel;
      let displayLabel = label;

      const isComparisonColumn = ['#', '△', '%', t('Main')].includes(
        column.label,
      );

      if (isComparisonColumn) {
        if (column.label === t('Main')) {
          displayLabel = config.customColumnName || column.originalLabel || '';
        } else if (config.customColumnName) {
          displayLabel =
            config.displayTypeIcon !== false
              ? `${column.label} ${config.customColumnName}`
              : config.customColumnName;
        } else if (config.displayTypeIcon === false) {
          displayLabel = '';
        }
      }

      const columnWidth = Number.isNaN(Number(config.columnWidth))
        ? config.columnWidth
        : Number(config.columnWidth);

      const sharedStyle: CSSProperties = getSharedStyle(column);

      const alignPositiveNegative =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;
      const colorPositiveNegative =
        config.colorPositiveNegative === undefined
          ? defaultColorPN
          : config.colorPositiveNegative;

      const { truncateLongCells } = config;

      const hasColumnColorFormatters =
        Array.isArray(columnColorFormatters) &&
        columnColorFormatters.length > 0;

      const hasBasicColorFormatters =
        isUsingTimeComparison &&
        Array.isArray(basicColorFormatters) &&
        basicColorFormatters.length > 0;
      const valueRange =
        !hasBasicColorFormatters &&
        !hasColumnColorFormatters &&
        (config.showCellBars === undefined
          ? showCellBars
          : config.showCellBars) &&
        (isMetric || isRawRecords || isPercentMetric) &&
        getValueRange(key, alignPositiveNegative);

      let className = '';

      if (emitCrossFilters && !isMetric) className += ' dt-is-filter';

      if (!isMetric && !isPercentMetric) {
        className += ' right-border-only';
      } else if (comparisonLabels.includes(label)) {
        const groupinHeader = key.substring(label.length);
        const columnsUnderHeader = groupHeaderColumns[groupinHeader] || [];
        if (i === columnsUnderHeader[columnsUnderHeader.length - 1])
          className += ' right-border-only';
      }

      return {
        id: String(i),
        columnKey: key,
        accessor: ((datum: D) => datum[key]) as never,
        Cell: ({ value, row }: { value: DataRecordValue; row: Row<D> }) => {
          const [isHtml, text] = formatColumnValue(column, value);
          const html = isHtml && allowRenderHtml ? { __html: text } : undefined;

          let backgroundColor;
          let color;
          let arrow = '';
          const originKey = column.key.substring(column.label.length).trim();
          if (!hasColumnColorFormatters && hasBasicColorFormatters) {
            backgroundColor =
              basicColorFormatters[row.index][originKey]?.backgroundColor;
            arrow =
              column.label === comparisonLabels[0]
                ? basicColorFormatters[row.index][originKey]?.mainArrow
                : '';
          }

          if (hasColumnColorFormatters) {
            const applyFormatter = (
              formatter: ColorFormatters[number],
              valueToFormat: any,
            ) => {
              const hasValue =
                valueToFormat !== undefined && valueToFormat !== null;
              if (!hasValue) return;

              const formatterResult =
                formatter.getColorFromValue(valueToFormat);
              if (!formatterResult) return;

              if (formatter.toTextColor) {
                color = formatterResult.slice(0, -2);
              } else {
                backgroundColor = formatterResult;
              }
            };
            columnColorFormatters
              .filter(formatter => formatter.column === column.key)
              .forEach(formatter => applyFormatter(formatter, value));

            columnColorFormatters
              .filter(formatter => formatter.toAllRow)
              .forEach(formatter =>
                applyFormatter(formatter, row.original[formatter.column]),
              );
          }

          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            backgroundColor =
              basicColorColumnFormatters[row.index][column.key]
                ?.backgroundColor || backgroundColor;
            arrow =
              column.label === comparisonLabels[0]
                ? basicColorColumnFormatters[row.index][column.key]?.mainArrow
                : '';
          }
          const StyledCell = styled.td`
            color: ${color ? `${color}FF` : theme.colorText};
            text-align: ${sharedStyle.textAlign};
            white-space: ${value instanceof Date ? 'nowrap' : undefined};
            position: relative;
            background: ${backgroundColor || undefined};
            padding-left: ${column.isChildColumn
              ? `${theme.sizeUnit * 5}px`
              : `${theme.sizeUnit}px`};
          `;

          const cellBarStyles = css`
            position: absolute;
            height: 100%;
            display: block;
            top: 0;
            ${valueRange &&
            `
                width: ${`${cellWidth({
                  value: value as number,
                  valueRange,
                  alignPositiveNegative,
                })}%`};
                left: ${`${cellOffset({
                  value: value as number,
                  valueRange,
                  alignPositiveNegative,
                })}%`};
                background-color: ${cellBackground({
                  value: value as number,
                  colorPositiveNegative,
                  theme,
                })};
              `}
          `;

          let arrowStyles = css`
            color: ${basicColorFormatters &&
            basicColorFormatters[row.index][originKey]?.arrowColor ===
              ColorSchemeEnum.Green
              ? theme.colorSuccess
              : theme.colorError};
            margin-right: ${theme.sizeUnit}px;
          `;

          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            arrowStyles = css`
              color: ${basicColorColumnFormatters[row.index][column.key]
                ?.arrowColor === ColorSchemeEnum.Green
                ? theme.colorSuccess
                : theme.colorError};
              margin-right: ${theme.sizeUnit}px;
            `;
          }

          const cellProps = {
            'aria-labelledby': `header-${column.key}`,
            role: 'cell',
            title: typeof value === 'number' ? String(value) : undefined,
            onClick:
              emitCrossFilters && !valueRange && !isMetric
                ? () => {
                    if (!getSelectedText()) handleToggleFilter(key, value);
                  }
                : undefined,
            onContextMenu: (e: MouseEvent) => {
              if (handleContextMenu) {
                e.preventDefault();
                e.stopPropagation();
                handleContextMenu(
                  row.original,
                  { key, value, isMetric },
                  e.nativeEvent.clientX,
                  e.nativeEvent.clientY,
                );
              }
            },
            className: [
              className,
              value == null ||
              (value instanceof DateWithFormatter && value.input == null)
                ? 'dt-is-null'
                : '',
              isActiveFilterValue(key, value) ? ' dt-is-active-filter' : '',
            ].join(' '),
            tabIndex: 0,
          };

          if (html) {
            if (truncateLongCells) {
              return (
                <StyledCell {...cellProps}>
                  <div
                    className="dt-truncate-cell"
                    style={columnWidth ? { width: columnWidth } : undefined}
                    dangerouslySetInnerHTML={html}
                  />
                </StyledCell>
              );
            }

            return <StyledCell {...cellProps} dangerouslySetInnerHTML={html} />;
          }

          return (
            <StyledCell {...cellProps}>
              {valueRange && (
                <div
                  /* The following classes are added to support custom CSS styling */
                  className={cx(
                    'cell-bar',
                    typeof value === 'number' && value < 0
                      ? 'negative'
                      : 'positive',
                  )}
                  css={cellBarStyles}
                  role="presentation"
                />
              )}
              {truncateLongCells ? (
                <div
                  className="dt-truncate-cell"
                  style={columnWidth ? { width: columnWidth } : undefined}
                >
                  {arrow && <span css={arrowStyles}>{arrow}</span>}
                  {text}
                </div>
              ) : (
                <>
                  {arrow && <span css={arrowStyles}>{arrow}</span>}
                  {text}
                </>
              )}
            </StyledCell>
          );
        },
        Header: ({ column: col, onClick, style, onDragStart, onDrop }) => (
          <th
            id={`header-${column.originalLabel}`}
            title={t('Shift + Click to sort by multiple columns')}
            className={[className, col.isSorted ? 'is-sorted' : ''].join(' ')}
            style={{
              ...sharedStyle,
              ...style,
            }}
            onKeyDown={(e: ReactKeyboardEvent<HTMLElement>) => {
              if (Object.values(ACTION_KEYS).includes(e.key))
                col.toggleSortBy();
            }}
            role="columnheader button"
            onClick={onClick}
            data-column-name={col.id}
            {...(allowRearrangeColumns && {
              draggable: 'true',
              onDragStart,
              onDragOver: e => e.preventDefault(),
              onDragEnter: e => e.preventDefault(),
              onDrop,
            })}
            tabIndex={0}
          >
            {config.columnWidth ? (
              <div
                style={{
                  width: columnWidth,
                  height: 0.01,
                }}
              />
            ) : null}
            <div
              data-column-name={col.id}
              css={{
                display: 'inline-flex',
                alignItems: 'flex-end',
              }}
            >
              <span data-column-name={col.id}>{displayLabel}</span>
              <SortIcon column={col} />
            </div>
          </th>
        ),

        Footer: totals ? (
          i === 0 ? (
            <th key={`footer-summary-${i}`}>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  & svg {
                    margin-left: ${theme.sizeUnit}px;
                    color: ${theme.colorBorder} !important;
                  }
                `}
              >
                {t('Summary')}
                <Tooltip
                  overlay={t(
                    'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
                  )}
                >
                  <InfoCircleOutlined />
                </Tooltip>
              </div>
            </th>
          ) : (
            <td key={`footer-total-${i}`} style={sharedStyle}>
              <strong>{formatColumnValue(column, totals[key])[1]}</strong>
            </td>
          )
        ) : undefined,
        sortDescFirst: sortDesc,
        sortType: getSortTypeByDataType(dataType),
      };
    },
    [
      defaultAlignPN,
      defaultColorPN,
      emitCrossFilters,
      getValueRange,
      isActiveFilterValue,
      isRawRecords,
      showCellBars,
      sortDesc,
      totals,
      columnColorFormatters,
      theme,
      allowRearrangeColumns,
      allowRenderHtml,
      basicColorColumnFormatters,
      basicColorFormatters,
      comparisonLabels,
      getSharedStyle,
      groupHeaderColumns,
      handleContextMenu,
      handleToggleFilter,
      isUsingTimeComparison,
      SortIcon,
    ],
  );

  return getColumnConfigs;
}
