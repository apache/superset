import React, {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';


import {ColumnInstance, ColumnWithLooseAccessor, DefaultSortTypes, Row,} from 'react-table';
import {extent as d3Extent, max as d3Max} from 'd3-array';
import {FaSort} from '@react-icons/all-files/fa/FaSort';
import {FaSortDown as FaSortDesc} from '@react-icons/all-files/fa/FaSortDown';
import {FaSortUp as FaSortAsc} from '@react-icons/all-files/fa/FaSortUp';
import cx from 'classnames';
import {
  BinaryQueryObjectFilterClause,
  css,
  DataRecord,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  GenericDataType,
  getSelectedText,
  getTimeFormatterForGranularity,
  styled,
  t,
  tn,
  useTheme,
} from '@superset-ui/core';
import {Dropdown, Menu, Tooltip} from '@superset-ui/chart-controls';
import {
  CheckOutlined,
  DownOutlined,
  InfoCircleOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  TableOutlined,
} from '@ant-design/icons';
import {isEmpty} from 'lodash';
import {ColorSchemeEnum, DataColumnMeta, TableChartTransformedProps,} from './types';
import DataTable, {DataTableProps, SearchInputProps, SelectPageSizeRendererProps, SizeOption,} from './DataTable';

import Styles from './Styles';
import {formatColumnValue} from './utils/formatValue';
import {PAGE_SIZE_OPTIONS} from './consts';
import {updateExternalFormData} from './DataTable/utils/externalAPIs';
import getScrollBarSize from './DataTable/utils/getScrollBarSize';
import {ActionCell} from './ActionCell';
import {Alert} from "antd";

type ValueRange = [number, number];

interface TableSize {
  width: number;
  height: number;
}

const ACTION_KEYS = {
  enter: 'Enter',
  spacebar: 'Spacebar',
  space: ' ',
};

/**
 * Return sortType based on data type
 */
function getSortTypeByDataType(dataType: GenericDataType): DefaultSortTypes {
  if (dataType === GenericDataType.Temporal) {
    return 'datetime';
  }
  if (dataType === GenericDataType.String) {
    return 'alphanumeric';
  }
  return 'basic';
}

/**
 * Cell background width calculation for horizontal bar chart
 */
function cellWidth({
                     value,
                     valueRange,
                     alignPositiveNegative,
                   }: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  const [minValue, maxValue] = valueRange;
  if (alignPositiveNegative) {
    const perc = Math.abs(Math.round((value / maxValue) * 100));
    return perc;
  }
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  const perc2 = Math.round((Math.abs(value) / tot) * 100);
  return perc2;
}

/**
 * Cell left margin (offset) calculation for horizontal bar chart elements
 * when alignPositiveNegative is not set
 */
function cellOffset({
                      value,
                      valueRange,
                      alignPositiveNegative,
                    }: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  if (alignPositiveNegative) {
    return 0;
  }
  const [minValue, maxValue] = valueRange;
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  return Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
}

/**
 * Cell background color calculation for horizontal bar chart
 */
function cellBackground({
                          value,
                          colorPositiveNegative = false,
                        }: {
  value: number;
  colorPositiveNegative: boolean;
}) {
  const r = colorPositiveNegative && value < 0 ? 150 : 0;
  return `rgba(${r},0,0,0.2)`;
}

function SortIcon<D extends object>({column}: { column: ColumnInstance<D> }) {
  const {isSorted, isSortedDesc} = column;
  let sortIcon = <FaSort/>;
  if (isSorted) {
    sortIcon = isSortedDesc ? <FaSortDesc/> : <FaSortAsc/>;
  }
  return sortIcon;
}

function SearchInput({count, value, onChange}: SearchInputProps) {
  return (
    <span className="dt-global-filter">
      {t('Search')}{' '}
      <input
        aria-label={t('Search %s records', count)}
        className="form-control input-sm"
        placeholder={tn('search.num_records', count)}
        value={value}
        onChange={onChange}
      />
    </span>
  );
}

function SelectPageSize({
                          options,
                          current,
                          onChange,
                        }: SelectPageSizeRendererProps) {
  return (
    <span
      className="dt-select-page-size form-inline"
      role="group"
      aria-label={t('Select page size')}
    >
      <label htmlFor="pageSizeSelect" className="sr-only">
        {t('Select page size')}
      </label>
      {t('Show')}{' '}
      <select
        id="pageSizeSelect"
        className="form-control input-sm"
        value={current}
        onChange={e => {
          onChange(Number((e.target as HTMLSelectElement).value));
        }}
        aria-label={t('Show entries per page')}
      >
        {options.map(option => {
          const [size, text] = Array.isArray(option)
            ? option
            : [option, option];
          return (
            <option key={size} value={size}>
              {text}
            </option>
          );
        })}
      </select>{' '}
      {t('entries per page')}
    </span>
  );
}

const getNoResultsMessage = (filter: string) =>
  filter ? t('No matching records found') : t('No records found');

export default function TableChart<D extends DataRecord = DataRecord>(
  props: TableChartTransformedProps<D> & {
    sticky?: DataTableProps<D>['sticky'];
    enable_bulk_actions?: boolean;
    include_row_numbers?: boolean;
    bulk_action_id_column?: string;
    bulk_action_label?: string,
    selection_mode?: 'single' | 'multiple';
    split_actions?: Set<any>;
    non_split_actions?: Set<any>;
    onBulkActionClick?: (actionKey?: string, selectedIds?: string[]) => void;
    enable_table_actions?: boolean;
    table_actions_id_column?: string;
    hide_table_actions_id_column?: boolean;
    table_actions?: Set<any>;
    onTableActionClick?: (action?: string, id?: string, value?: string) => void;
    slice_id?: string;
    show_split_buttons_in_slice_header: boolean;
    retain_selection_accross_navigation: boolean;
  },
) {
  const {
    timeGrain,
    height,
    width,
    data,
    totals,
    isRawRecords,
    rowCount = 0,
    columns: columnsMeta,
    alignPositiveNegative: defaultAlignPN = false,
    colorPositiveNegative: defaultColorPN = false,
    includeSearch = false,
    pageSize = 0,
    serverPagination = false,
    serverPaginationData,
    setDataMask,
    showCellBars = true,
    sortDesc = false,
    filters,
    sticky = true, // whether to use sticky header
    columnColorFormatters,
    allowRearrangeColumns = false,
    allowRenderHtml = true,
    onContextMenu,
    emitCrossFilters,
    isUsingTimeComparison,
    basicColorFormatters,
    basicColorColumnFormatters,
    enable_bulk_actions = false,
    include_row_numbers = false,
    bulk_action_id_column = 'id',
    bulk_action_label = 'Bulk Action',
    selection_mode = 'multiple',
    split_actions ,
    non_split_actions ,
    enable_table_actions = false,
    table_actions_id_column = '',
    hide_table_actions_id_column = false,
    table_actions,
    show_split_buttons_in_slice_header = false,
    retain_selection_accross_navigation = false,
  } = props;

  const sliceId = props?.slice_id;
  const chartId = props?.slice_id;
  const resetOnMount =!props?.retain_selection_accross_navigation;


  const comparisonColumns = [
    {key: 'all', label: t('Display all')},
    {key: '#', label: '#'},
    {key: '△', label: '△'},
    {key: '%', label: '%'},
  ];
  const timestampFormatter = useCallback(
    value => getTimeFormatterForGranularity(timeGrain)(value),
    [timeGrain],
  );
  const [message, setMessage] = useState('');
  const [tableSize, setTableSize] = useState<TableSize>({
    width: 0,
    height: 0,
  });
  // keep track of whether column order changed, so that column widths can too
  const [columnOrderToggle, setColumnOrderToggle] = useState(false);
  const [showComparisonDropdown, setShowComparisonDropdown] = useState(false);
  const [selectedComparisonColumns, setSelectedComparisonColumns] = useState([
    comparisonColumns[0].key,
  ]);
  const [hideComparisonKeys, setHideComparisonKeys] = useState<string[]>([]);
  const theme = useTheme();
  const [selectedRows, setSelectedRows] = useState(new Set());
  // only take relevant page size options
  const pageSizeOptions = useMemo(() => {
    const getServerPagination = (n: number) => n <= rowCount;
    return PAGE_SIZE_OPTIONS.filter(([n]) =>
      serverPagination ? getServerPagination(n) : n <= 2 * data.length,
    ) as SizeOption[];
  }, [data.length, rowCount, serverPagination]);

  const getValueRange = useCallback(
    function getValueRange(key: string, alignPositiveNegative: boolean) {
      if (typeof data?.[0]?.[key] === 'number') {
        const nums = data.map(row => row[key]) as number[];
        return (
          alignPositiveNegative
            ? [0, d3Max(nums.map(Math.abs))]
            : d3Extent(nums)
        ) as ValueRange;
      }
      return null;
    },
    [data],
  );

  const isActiveFilterValue = useCallback(
    function isActiveFilterValue(key: string, val: DataRecordValue) {
      return !!filters && filters[key]?.includes(val);
    },
    [filters],
  );

  const parseOrConvertToSet = (input: any) => {
    // If input is a string, try to parse it.
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? new Set(parsed) : new Set();
      } catch (error) {
        return new Set();
      }
    }
    // If input is an array, convert it to a set.
    if (Array.isArray(input)) {
      return new Set(input);
    }
    // If input is already a Set, return it.
    if (input instanceof Set) {
      return input;
    }
    return new Set();
  };

  const actions = useMemo(
    () => ({
      split: parseOrConvertToSet(split_actions),
      nonSplit: parseOrConvertToSet(non_split_actions),
    } as any),
    [split_actions, non_split_actions],
  );

  const lastSelectedRow = useRef<string | null>(null);
  useEffect(() => {
    // Determine the navigation type
    // Create a key in sessionStorage to mark that we have done the initial load reset.
    // Use a global flag on the window object so that we only reset once per full page load.
    // On a full refresh, window.__tableChartResetDone will be undefined.
    // @ts-ignore
    if (resetOnMount && !window.__tableChartResetDone) {
      // Clear the stored selection and update the state
      localStorage.removeItem(`selectedRows_${sliceId}`);
      setSelectedRows(new Set());
      // Mark that we've already reset for this page load
      // @ts-ignore
      window.__tableChartResetDone = true;
    } else {
      // Load selected rows from localStorage on component mount
      const savedSelectedRows = localStorage.getItem(`selectedRows_${sliceId}`);
      if (savedSelectedRows) {
        setSelectedRows(new Set(JSON.parse(savedSelectedRows)));
      }
    }
  }, [sliceId, resetOnMount]);


  // Save selected rows to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`selectedRows_${sliceId}`, JSON.stringify([...selectedRows]));
    // Manually dispatch a storage event to notify other tabs/windows
    const event = new StorageEvent('storage', {
      key: `selectedRows_${sliceId}`,
      newValue: JSON.stringify([...selectedRows]),
      oldValue: localStorage.getItem(`selectedRows_${sliceId}`),
      storageArea: localStorage,
    });
    window.dispatchEvent(event);
  }, [selectedRows, sliceId]); // Add tableId as a dependency

  // @ts-ignore
  const handleRowSelect = useCallback(
    (rowId: string, event?: React.MouseEvent) => {
      setSelectedRows(prev => {
        const newSelected = new Set(prev);

        if (selection_mode === 'single') {
          // Single selection mode
          if (prev.has(rowId)) {
            newSelected.clear();
          } else {
            newSelected.clear();
            newSelected.add(rowId);
          }
        } else {
          // Multiple selection mode
          if (event?.shiftKey && lastSelectedRow.current) {
            // Shift+Click: Select range
            const visibleIds = data.map(row =>
              String(row[bulk_action_id_column as keyof D]),
            );
            const startIdx = visibleIds.indexOf(lastSelectedRow.current);
            const endIdx = visibleIds.indexOf(rowId);

            if (startIdx > -1 && endIdx > -1) {
              const [min, max] = [
                Math.min(startIdx, endIdx),
                Math.max(startIdx, endIdx),
              ];
              visibleIds.slice(min, max + 1).forEach(id => newSelected.add(id));
            }
          } else {
            // Regular click: Toggle single row
            if (prev.has(rowId)) {
              newSelected.delete(rowId);
            } else {
              newSelected.add(rowId);
            }
            lastSelectedRow.current = rowId;
          }
        }
        return newSelected;
      });
    },
    [selection_mode, data, bulk_action_id_column],
  );

  const handleTableAction = useCallback(
    (action: any) => {
      sendWindowPostMessge({
        action: action.action,
        chartId: action.chartId,
        actionType: action?.key,
        values: action.value
      });
    },
    [],
  );

  const handleBulkAction = useCallback(
    (action: any) => {
      sendWindowPostMessge({
        action: action.action,
        chartId: action.chartId,
        actionType: action?.key,
        values: action.value
      });

    },
    [],
  );

  useEffect(() => {
    const handleMessage = (event: any) => {
      // Check if the event data is what you expect

      if (event.data && event.data.notification === 'alert-event') {
        doShowAlertMessge(event.data.data);
      } else if (event.data && event.data.notification === 'publish-event') {
        doSendWindowPostMessge(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);


  function doSendWindowPostMessge(messageData: any) {
    window.parent.postMessage(messageData, '*', [new MessageChannel().port2]);
  }

  function doShowAlertMessge(messageData: any) {
    setMessage(JSON.stringify(messageData));
    setTimeout(() => setMessage(''), 5000);
  }


  function sendWindowPostMessge(messageData: any) {
    if (window.self !== window.top) {
      doSendWindowPostMessge(messageData);
    } else {
      doShowAlertMessge(messageData);
    }
  }


  const tableActionsConfig = useMemo(() => {
    if (!enable_table_actions || !table_actions_id_column || !table_actions) {
      return undefined;
    }

    try {
      const actions = parseOrConvertToSet(table_actions);
      return {
        idColumn: table_actions_id_column,
        actions,
      };
    } catch (e) {
      return undefined;
    }
  }, [enable_table_actions, table_actions_id_column, table_actions]);

  const handleBulkSelect = useCallback(
    (visibleData: D[]) => {
      // Get IDs of only the visible rows
      const visibleIds = visibleData.map(row =>
        String(row[bulk_action_id_column as keyof D]),
      );

      setSelectedRows(prev => {
        // Start with empty Set
        const newSelected = new Set<string>();

        // Check if all currently visible rows were selected in the previous state
        const allVisibleSelected =
          visibleIds.length > 0 && visibleIds.every(id => prev.has(id));

        if (!allVisibleSelected) {
          // If not all visible rows were selected, select all visible rows
          visibleIds.forEach(id => newSelected.add(id));
        }
        // If all were selected, return empty Set

        return newSelected;
      });
    },
    [bulk_action_id_column],
  );

  const getCrossFilterDataMask = (key: string, value: DataRecordValue) => {
    let updatedFilters = {...(filters || {})};
    if (filters && isActiveFilterValue(key, value)) {
      updatedFilters = {};
    } else {
      updatedFilters = {
        [key]: [value],
      };
    }
    if (
      Array.isArray(updatedFilters[key]) &&
      updatedFilters[key].length === 0
    ) {
      delete updatedFilters[key];
    }
    const groupBy = Object.keys(updatedFilters);
    const groupByValues = Object.values(updatedFilters);
    const labelElements: string[] = [];
    groupBy.forEach(col => {
      const isTimestamp = col === DTTM_ALIAS;
      const filterValues = ensureIsArray(updatedFilters?.[col]);
      if (filterValues.length) {
        const valueLabels = filterValues.map(value =>
          isTimestamp ? timestampFormatter(value) : value,
        );
        labelElements.push(`${valueLabels.join(', ')}`);
      }
    });
    return {
      dataMask: {
        extraFormData: {
          filters:
            groupBy.length === 0
              ? []
              : groupBy.map(col => {
                const val = ensureIsArray(updatedFilters?.[col]);
                if (!val.length)
                  return {
                    col,
                    op: 'IS NULL' as const,
                  };
                return {
                  col,
                  op: 'IN' as const,
                  val: val.map(el =>
                    el instanceof Date ? el.getTime() : el!,
                  ),
                  grain: col === DTTM_ALIAS ? timeGrain : undefined,
                };
              }),
        },
        filterState: {
          label: labelElements.join(', '),
          value: groupByValues.length ? groupByValues : null,
          filters:
            updatedFilters && Object.keys(updatedFilters).length
              ? updatedFilters
              : null,
        },
      },
      isCurrentValueSelected: isActiveFilterValue(key, value),
    };
  };

  const toggleFilter = useCallback(
    function toggleFilter(key: string, val: DataRecordValue) {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(key, val).dataMask);
    },
    [emitCrossFilters, getCrossFilterDataMask, setDataMask],
  );

  const getSharedStyle = (column: DataColumnMeta): CSSProperties => {
    const {isNumeric, config = {}} = column;
    const textAlign =
      config.horizontalAlign ||
      (isNumeric && !isUsingTimeComparison ? 'right' : 'left');
    return {
      textAlign,
    };
  };

  const comparisonLabels = [t('Main'), '#', '△', '%'];
  const filteredColumnsMeta = useMemo(() => {
    if (!isUsingTimeComparison) {
      return columnsMeta;
    }
    const allColumns = comparisonColumns[0].key;
    const main = comparisonLabels[0];
    const showAllColumns = selectedComparisonColumns.includes(allColumns);
    return columnsMeta.filter(({label, key}) => {
      // Extract the key portion after the space, assuming the format is always "label key"
      const keyPortion = key.substring(label.length);
      const isKeyHidded = hideComparisonKeys.includes(keyPortion);
      const isLableMain = label === main;

      return (
        isLableMain ||
        (!isKeyHidded &&
          (!comparisonLabels.includes(label) ||
            showAllColumns ||
            selectedComparisonColumns.includes(label)))
      );
    });
  }, [
    columnsMeta,
    comparisonColumns,
    comparisonLabels,
    isUsingTimeComparison,
    hideComparisonKeys,
    selectedComparisonColumns,
  ]);

  const handleContextMenu =
    onContextMenu && !isRawRecords
      ? (
        value: D,
        cellPoint: {
          key: string;
          value: DataRecordValue;
          isMetric?: boolean;
        },
        clientX: number,
        clientY: number,
      ) => {
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        filteredColumnsMeta.forEach(col => {
          if (!col.isMetric) {
            const dataRecordValue = value[col.key];
            drillToDetailFilters.push({
              col: col.key,
              op: '==',
              val: dataRecordValue as string | number | boolean,
              formattedVal: formatColumnValue(col, dataRecordValue)[1],
            });
          }
        });
        onContextMenu(clientX, clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: cellPoint.isMetric
            ? undefined
            : getCrossFilterDataMask(cellPoint.key, cellPoint.value),
          drillBy: cellPoint.isMetric
            ? undefined
            : {
              filters: [
                {
                  col: cellPoint.key,
                  op: '==',
                  val: cellPoint.value as string | number | boolean,
                },
              ],
              groupbyFieldName: 'groupby',
            },
        });
      }
      : undefined;

  const getHeaderColumns = (
    columnsMeta: DataColumnMeta[],
    enableTimeComparison?: boolean,
  ) => {
    const resultMap: Record<string, number[]> = {};
    if (!enableTimeComparison) {
      return resultMap;
    }
    columnsMeta.forEach((element, index) => {
      // Check if element's label is one of the comparison labels
      if (comparisonLabels.includes(element.label)) {
        // Extract the key portion after the space, assuming the format is always "label key"
        const keyPortion = element.key.substring(element.label.length);

        // If the key portion is not in the map, initialize it with the current index
        if (!resultMap[keyPortion]) {
          resultMap[keyPortion] = [index];
        } else {
          // Add the index to the existing array
          resultMap[keyPortion].push(index);
        }
      }
    });
    return resultMap;
  };

  const renderTimeComparisonDropdown = (): JSX.Element => {
    const allKey = comparisonColumns[0].key;
    const handleOnClick = (data: any) => {
      const {key} = data;
      // Toggle 'All' key selection
      if (key === allKey) {
        setSelectedComparisonColumns([allKey]);
      } else if (selectedComparisonColumns.includes(allKey)) {
        setSelectedComparisonColumns([key]);
      } else {
        // Toggle selection for other keys
        setSelectedComparisonColumns(
          selectedComparisonColumns.includes(key)
            ? selectedComparisonColumns.filter(k => k !== key) // Deselect if already selected
            : [...selectedComparisonColumns, key],
        ); // Select if not already selected
      }
    };

    const handleOnBlur = () => {
      if (selectedComparisonColumns.length === 3) {
        setSelectedComparisonColumns([comparisonColumns[0].key]);
      }
    };

    return (
      <Dropdown
        placement="bottomRight"
        visible={showComparisonDropdown}
        onVisibleChange={(flag: boolean) => {
          setShowComparisonDropdown(flag);
        }}
        overlay={
          <Menu
            multiple
            onClick={handleOnClick}
            onBlur={handleOnBlur}
            selectedKeys={selectedComparisonColumns}
          >
            <div
              css={css`
                max-width: 242px;
                padding: 0 ${theme.gridUnit * 2}px;
                color: ${theme.colors.grayscale.base};
                font-size: ${theme.typography.sizes.s}px;
              `}
            >
              {t(
                'Select columns that will be displayed in the table. You can multiselect columns.',
              )}
            </div>
            {comparisonColumns.map(column => (
              <Menu.Item key={column.key}>
                <span
                  css={css`
                    color: ${theme.colors.grayscale.dark2};
                  `}
                >
                  {column.label}
                </span>
                <span
                  css={css`
                    float: right;
                    font-size: ${theme.typography.sizes.s}px;
                  `}
                >
                  {selectedComparisonColumns.includes(column.key) && (
                    <CheckOutlined/>
                  )}
                </span>
              </Menu.Item>
            ))}
          </Menu>
        }
        trigger={['click']}
      >
        <span>
          <TableOutlined/> <DownOutlined/>
        </span>
      </Dropdown>
    );
  };

  const renderGroupingHeaders = (): JSX.Element => {
    // TODO: Make use of ColumnGroup to render the aditional headers
    const headers: any = [];
    let currentColumnIndex = 0;
    Object.entries(groupHeaderColumns || {}).forEach(([key, value]) => {
      // Calculate the number of placeholder columns needed before the current header
      const startPosition = value[0];
      const colSpan = value.length;

      // Add placeholder <th> for columns before this header
      for (let i = currentColumnIndex; i < startPosition; i += 1) {
        headers.push(
          <th
            key={`placeholder-${i}`}
            style={{borderBottom: 0}}
            aria-label={`Header-${i}`}
          />,
        );
      }

      // Add the current header <th>
      headers.push(
        <th key={`header-${key}`} colSpan={colSpan} style={{borderBottom: 0}}>
          {key}
          <span
            css={css`
              float: right;

              & svg {
                color: ${theme.colors.grayscale.base} !important;
              }
            `}
          >
            {hideComparisonKeys.includes(key) ? (
              <PlusCircleOutlined
                onClick={() =>
                  setHideComparisonKeys(
                    hideComparisonKeys.filter(k => k !== key),
                  )
                }
              />
            ) : (
              <MinusCircleOutlined
                onClick={() =>
                  setHideComparisonKeys([...hideComparisonKeys, key])
                }
              />
            )}
          </span>
        </th>,
      );

      // Update the current column index
      currentColumnIndex = startPosition + colSpan;
    });
    return (
      <tr
        css={css`
          th {
            border-right: 2px solid ${theme.colors.grayscale.light2};
          }

          th:first-child {
            border-left: none;
          }

          th:last-child {
            border-right: none;
          }
        `}
      >
        {headers}
      </tr>
    );
  };

  const groupHeaderColumns = useMemo(
    () => getHeaderColumns(filteredColumnsMeta, isUsingTimeComparison),
    [filteredColumnsMeta, isUsingTimeComparison],
  );

  const getColumnConfigs = useCallback(
    (column: DataColumnMeta, i: number): ColumnWithLooseAccessor<D> => {
      const {
        key,
        label,
        isNumeric,
        dataType,
        isMetric,
        isPercentMetric,
        config = {},
      } = column;
      const columnWidth = Number.isNaN(Number(config.columnWidth))
        ? config.columnWidth
        : Number(config.columnWidth);

      // inline style for both th and td cell
      const sharedStyle: CSSProperties = getSharedStyle(column);
      const alignPositiveNegative =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;
      const colorPositiveNegative =
        config.colorPositiveNegative === undefined
          ? defaultColorPN
          : config.colorPositiveNegative;
      const {truncateLongCells} = config;
      const hasColumnColorFormatters =
        isNumeric &&
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
      if (emitCrossFilters && !isMetric) {
        className += ' dt-is-filter';
      }
      if (!isMetric && !isPercentMetric) {
        className += ' right-border-only';
      } else if (comparisonLabels.includes(label)) {
        const groupinHeader = key.substring(label.length);
        const columnsUnderHeader = groupHeaderColumns[groupinHeader] || [];
        if (i === columnsUnderHeader[columnsUnderHeader.length - 1]) {
          className += ' right-border-only';
        }
      }
      return {
        id: String(i), // to allow duplicate column keys
        // must use custom accessor to allow `.` in column names
        // typing is incorrect in current version of `@types/react-table`
        // so we ask TS not to check.
        accessor: ((datum: D) => datum[key]) as never,
        Cell: ({value, row}: { value: DataRecordValue; row: Row<D> }) => {
          const [isHtml, text] = formatColumnValue(column, value);
          const html = isHtml && allowRenderHtml ? {__html: text} : undefined;
          let backgroundColor;
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
            columnColorFormatters!
              .filter(formatter => formatter.column === column.key)
              .forEach(formatter => {
                const formatterResult =
                  value || value === 0
                    ? formatter.getColorFromValue(value as number)
                    : false;
                if (formatterResult) {
                  backgroundColor = formatterResult;
                }
              });
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
            text-align: ${sharedStyle.textAlign};
            white-space: ${value instanceof Date ? 'nowrap' : undefined};
            position: relative;
            background: ${backgroundColor || undefined};
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
            })};
          `}
          `;
          let arrowStyles = css`
            color: ${basicColorFormatters &&
            basicColorFormatters[row.index][originKey]?.arrowColor ===
            ColorSchemeEnum.Green
              ? theme.colors.success.base
              : theme.colors.error.base};
            margin-right: ${theme.gridUnit}px;
          `;
          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            arrowStyles = css`
              color: ${basicColorColumnFormatters[row.index][column.key]
                ?.arrowColor === ColorSchemeEnum.Green
                ? theme.colors.success.base
                : theme.colors.error.base};
              margin-right: ${theme.gridUnit}px;
            `;
          }
          const cellProps = {
            'aria-labelledby': `header-${column.key}`,
            role: 'cell',
            // show raw number in title in case of numeric values
            title: typeof value === 'number' ? String(value) : undefined,
            onClick:
              emitCrossFilters && !valueRange && !isMetric
                ? () => {
                  // allow selecting text in a cell
                  if (!getSelectedText()) {
                    toggleFilter(key, value);
                  }
                }
                : undefined,
            onContextMenu: (e: MouseEvent) => {
              if (handleContextMenu) {
                e.preventDefault();
                e.stopPropagation();
                handleContextMenu(
                  row.original,
                  {key, value, isMetric},
                  e.nativeEvent.clientX,
                  e.nativeEvent.clientY,
                );
              }
            },
            className: [
              className,
              value == null ? 'dt-is-null' : '',
              isActiveFilterValue(key, value) ? ' dt-is-active-filter' : '',
            ].join(' '),
            tabIndex: 0,
          };
          if (html) {
            if (truncateLongCells) {
              // eslint-disable-next-line react/no-danger
              return (
                <StyledCell {...cellProps}>
                  <div
                    className="dt-truncate-cell"
                    style={columnWidth ? {width: columnWidth} : undefined}
                    dangerouslySetInnerHTML={html}
                  />
                </StyledCell>
              );
            }
            // eslint-disable-next-line react/no-danger
            return <StyledCell {...cellProps} dangerouslySetInnerHTML={html}/>;
          }
          // If cellProps renders textContent already, then we don't have to
          // render `Cell`. This saves some time for large tables.
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
                  style={columnWidth ? {width: columnWidth} : undefined}
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
        Header: ({column: col, onClick, style, onDragStart, onDrop}) => (
          <th
            id={`header-${column.key}`}
            title={t('Shift + Click to sort by multiple columns')}
            className={[className, col.isSorted ? 'is-sorted' : ''].join(' ')}
            style={{
              ...sharedStyle,
              ...style,
            }}
            onKeyDown={(e: ReactKeyboardEvent<HTMLElement>) => {
              // programatically sort column on keypress
              if (Object.values(ACTION_KEYS).includes(e.key)) {
                col.toggleSortBy();
              }
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
            {/* can't use `columnWidth &&` because it may also be zero */}
            {config.columnWidth ? (
              // column width hint
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
              <span data-column-name={col.id}>{label}</span>
              <SortIcon column={col}/>
            </div>
          </th>
        ),
        Footer: totals ? (
          i === 0 ? (
            <th>
              <div
                css={css`
                  display: flex;
                  align-items: center;

                  & svg {
                    margin-left: ${theme.gridUnit}px;
                    color: ${theme.colors.grayscale.dark1} !important;
                  }
                `}
              >
                {t('Summary')}
                <Tooltip
                  overlay={t(
                    'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
                  )}
                >
                  <InfoCircleOutlined/>
                </Tooltip>
              </div>
            </th>
          ) : (
            <td style={sharedStyle}>
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
      toggleFilter,
      totals,
      columnColorFormatters,
      columnOrderToggle,
    ],
  );

  const columns = useMemo(
    () => filteredColumnsMeta.map(getColumnConfigs),
    [filteredColumnsMeta, getColumnConfigs],
  );

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      updateExternalFormData(setDataMask, pageNumber, pageSize);
    },
    [setDataMask],
  );

  const handleSizeChange = useCallback(
    ({width, height}: { width: number; height: number }) => {
      setTableSize({width, height});
    },
    [],
  );

  useLayoutEffect(() => {
    // After initial load the table should resize only when the new sizes
    // Are not only scrollbar updates, otherwise, the table would twitch
    const scrollBarSize = getScrollBarSize();
    const {width: tableWidth, height: tableHeight} = tableSize;
    // Table is increasing its original size
    if (
      width - tableWidth > scrollBarSize ||
      height - tableHeight > scrollBarSize
    ) {
      handleSizeChange({
        width: width - scrollBarSize,
        height: height - scrollBarSize,
      });
    } else if (
      tableWidth - width > scrollBarSize ||
      tableHeight - height > scrollBarSize
    ) {
      // Table is decreasing its original size
      handleSizeChange({
        width,
        height,
      });
    }
  }, [width, height, handleSizeChange, tableSize]);

  const {width: widthFromState, height: heightFromState} = tableSize;
  const columnsWithSelection = useMemo(() => {
    let finalColumns = columns;

    // Add selection column if bulk actions enabled
    if (enable_bulk_actions || include_row_numbers) {
      const selectionColumn = {
        id: 'selection',
        Header: ({data}: { data: D[] }) => {
          const visibleIds = data.map(row =>
            String(row[bulk_action_id_column as keyof D]),
          );
          const allVisibleSelected =
            visibleIds.length > 0 &&
            visibleIds.every(id => selectedRows.has(id));
          const someVisibleSelected =
            !allVisibleSelected && visibleIds.some(id => selectedRows.has(id));

          return (
            <td className=" right-border-only " role="columnheader button" tabIndex={0} width="50px">
              <div className="selection-cell">
                {enable_bulk_actions && (
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => {
                      if (el) {
                        el.indeterminate = someVisibleSelected;
                      }
                    }}
                    onChange={() => handleBulkSelect(data)}
                    disabled={selection_mode === 'single'}
                  />
                )}
                {include_row_numbers && (
                  <span className="selection-cell-number">#</span>
                )}
              </div>
            </td>
          );
        },
        Cell: ({row}: { row: Row<D> }) => {
          const rowId = String(
            row.original[bulk_action_id_column as keyof D] ?? row.index,
          );
          const currentPage = serverPaginationData.currentPage || 0; // Get current page index (0-based)
          const pageSize = serverPaginationData.pageSize || 10; // Get current page size
          const rowNumber = currentPage * pageSize + row.index + 1; // Calculate row number
          return (
            <td aria-labelledby="selection-cell" role="cell" className="right-border-only" tabIndex={0} width="50px"
                style={{overflow: 'hidden', paddingRight: "5px", paddingLeft: "5px"}}>
              <div className="selection-cell">
                {enable_bulk_actions && (
                  selection_mode === 'single' ? (
                    <input
                      type="radio"
                      checked={selectedRows.has(rowId)}
                      onChange={e => {
                        setSelectedRows(
                          new Set(selectedRows.has(rowId) ? [] : [rowId])
                        );
                      }}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={selectedRows.has(rowId)}
                      onChange={e => {
                        setSelectedRows(prev => {
                          const newSelected = new Set(prev);
                          if (e.target.checked) {
                            newSelected.add(rowId);
                          } else {
                            newSelected.delete(rowId);
                          }
                          return newSelected;
                        });
                      }}
                    />
                  )
                )}
              {include_row_numbers && (
                <span className="selection-cell-number" title={rowNumber.toString()}>{rowNumber}</span>
              )}
            </div>
        </td>
        )
          ;
        },
        width: 40,
      };
      finalColumns = [selectionColumn, ...finalColumns] as any;
    }

    // Add actions column if table actions enabled
    if (tableActionsConfig?.idColumn && tableActionsConfig?.actions) {
      const actionColumn = {
        id: 'actions',
        Header: () => (
          <th data-column-name="actions" >
            <span data-column-name="actions">{t('Actions')}</span>
          </th>
        ),
        Cell: ({row}: { row: Row<D> }) => {
          return (
            <ActionCell
              rowId={tableActionsConfig.idColumn}
              actions={tableActionsConfig.actions}
              row={row.original}
              chartId={chartId}
              idColumn ={tableActionsConfig.idColumn}
              onActionClick={handleTableAction}
            />
          );
        },
        width: 100,
      };
      finalColumns = [...finalColumns, actionColumn];
    }

    return finalColumns;
  }, [
    columns,
    enable_bulk_actions,
    bulk_action_id_column,
    selectedRows,
    selection_mode,
    handleBulkSelect,
    tableActionsConfig,
    handleTableAction,
  ]);


  useEffect(
    () => () => {
      setSelectedRows(new Set());
    },
    [],
  );

  return (
    <>
      {message && <Alert message={message} type="info" closable
                         style={{position: 'fixed', top: 115, right: 20, zIndex: 1000}} showIcon/>}
      <Styles>
        <DataTable<D>
          columns={columnsWithSelection}
          data={data}
          rowCount={rowCount}
          tableClassName="table table-striped table-condensed"
          pageSize={pageSize}
          serverPaginationData={serverPaginationData}
          pageSizeOptions={pageSizeOptions}
          width={widthFromState}
          height={heightFromState}
          serverPagination={serverPagination}
          onServerPaginationChange={handleServerPaginationChange}
          onColumnOrderChange={() => setColumnOrderToggle(!columnOrderToggle)}
          // 9 page items in > 340px works well even for 100+ pages
          maxPageItemCount={width > 340 ? 9 : 7}
          noResults={getNoResultsMessage}
          searchInput={includeSearch && SearchInput}
          selectPageSize={pageSize !== null && SelectPageSize}
          // not in use in Superset, but needed for unit tests
          sticky={sticky}
          renderGroupingHeaders={
            !isEmpty(groupHeaderColumns) ? renderGroupingHeaders : undefined
          }
          renderTimeComparisonDropdown={
            isUsingTimeComparison ? renderTimeComparisonDropdown : undefined
          }
          selectedRows={selectedRows}
          enableBulkActions={enable_bulk_actions}
          bulkActions={actions}
          enableTableActions={enable_table_actions}
          includeRowNumber={include_row_numbers}
          tableActionsIdColumn={table_actions_id_column}
          hideTableActionsIdColumn={hide_table_actions_id_column}
          bulkActionLabel={bulk_action_label}
          tableActions={table_actions}
          onBulkActionClick={handleBulkAction}
          showSplitInSliceHeader={show_split_buttons_in_slice_header}
          retainSelectionAccrossNavigation={retain_selection_accross_navigation}
        />
      </Styles>
    </>
  );
}
