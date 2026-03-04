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
  ReactNode,
  MouseEvent,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import { safeHtmlSpan } from '@superset-ui/core';
import { t } from '@apache-superset/core/ui';
import PropTypes from 'prop-types';
import { FaSort } from 'react-icons/fa';
import { FaSortDown as FaSortDesc } from 'react-icons/fa';
import { FaSortUp as FaSortAsc } from 'react-icons/fa';
import { PivotData, flatKey } from './utilities';
import { Styles } from './Styles';

interface CellColorFormatter {
  column: string;
  getColorFromValue(value: unknown): string | undefined;
}

type ClickCallback = (
  e: MouseEvent,
  value: unknown,
  filters: Record<string, string>,
  pivotData: InstanceType<typeof PivotData>,
) => void;

type HeaderClickCallback = (
  e: MouseEvent,
  value: string,
  filters: Record<string, string>,
  pivotData: InstanceType<typeof PivotData>,
  isSubtotal: boolean,
  isGrandTotal: boolean,
) => void;

interface TableOptions {
  rowTotals?: boolean;
  colTotals?: boolean;
  rowSubTotals?: boolean;
  colSubTotals?: boolean;
  clickCallback?: ClickCallback;
  clickColumnHeaderCallback?: HeaderClickCallback;
  clickRowHeaderCallback?: HeaderClickCallback;
  highlightHeaderCellsOnHover?: boolean;
  omittedHighlightHeaderGroups?: string[];
  highlightedHeaderCells?: Record<string, unknown[]>;
  cellColorFormatters?: Record<string, CellColorFormatter[]>;
  dateFormatters?: Record<string, ((val: unknown) => string) | undefined>;
}

interface SubtotalDisplay {
  displayOnTop: boolean;
  enabled?: boolean;
  hideOnExpand: boolean;
}

interface SubtotalOptions {
  arrowCollapsed?: ReactNode;
  arrowExpanded?: ReactNode;
  colSubtotalDisplay?: Partial<SubtotalDisplay>;
  rowSubtotalDisplay?: Partial<SubtotalDisplay>;
}

interface TableRendererProps {
  cols: string[];
  rows: string[];
  aggregatorName: string;
  tableOptions?: TableOptions;
  subtotalOptions?: SubtotalOptions;
  namesMapping?: Record<string, string>;
  onContextMenu: (
    e: MouseEvent,
    colKey?: string[],
    rowKey?: string[],
    filters?: Record<string, string>,
  ) => void;
  allowRenderHtml?: boolean;
  [key: string]: unknown;
}

interface PivotSettings {
  pivotData: InstanceType<typeof PivotData>;
  colAttrs: string[];
  rowAttrs: string[];
  colKeys: string[][];
  rowKeys: string[][];
  rowTotals: boolean;
  colTotals: boolean;
  arrowCollapsed: ReactNode;
  arrowExpanded: ReactNode;
  colSubtotalDisplay: SubtotalDisplay;
  rowSubtotalDisplay: SubtotalDisplay;
  cellCallbacks: Record<string, Record<string, (e: MouseEvent) => void>>;
  rowTotalCallbacks: Record<string, (e: MouseEvent) => void>;
  colTotalCallbacks: Record<string, (e: MouseEvent) => void>;
  grandTotalCallback: ((e: MouseEvent) => void) | null;
  namesMapping: Record<string, string>;
  allowRenderHtml?: boolean;
  visibleRowKeys?: string[][];
  visibleColKeys?: string[][];
  maxRowVisible?: number;
  maxColVisible?: number;
  rowAttrSpans?: number[][];
  colAttrSpans?: number[][];
}

const parseLabel = (value: unknown): string | number => {
  if (typeof value === 'string') {
    if (value === 'metric') return t('metric');
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  return String(value);
};

function displayCell(value: unknown, allowRenderHtml?: boolean): ReactNode {
  if (allowRenderHtml && typeof value === 'string') {
    return safeHtmlSpan(value);
  }
  return parseLabel(value);
}
function displayHeaderCell(
  needToggle: boolean,
  ArrowIcon: ReactNode,
  onArrowClick: ((e: MouseEvent<HTMLSpanElement>) => void) | null,
  value: unknown,
  namesMapping: Record<string, string>,
  allowRenderHtml?: boolean,
): ReactNode {
  const name = namesMapping[String(value)] || value;
  const parsedLabel = parseLabel(name);
  const labelContent =
    allowRenderHtml && typeof parsedLabel === 'string'
      ? safeHtmlSpan(parsedLabel)
      : parsedLabel;
  return needToggle ? (
    <span className="toggle-wrapper">
      <span
        role="button"
        tabIndex={0}
        className="toggle"
        onClick={onArrowClick || undefined}
      >
        {ArrowIcon}
      </span>
      <span className="toggle-val">{labelContent}</span>
    </span>
  ) : (
    labelContent
  );
}

interface HierarchicalNode {
  currentVal?: number;
  [key: string]: HierarchicalNode | number | undefined;
}

function sortHierarchicalObject(
  obj: Record<string, HierarchicalNode>,
  objSort: string,
  rowPartialOnTop: boolean | undefined,
): Map<string, unknown> {
  // Performs a recursive sort of nested object structures. Sorts objects based on
  // their currentVal property. The function preserves the hierarchical structure
  // while sorting each level according to the specified criteria.
  const sortedKeys = Object.keys(obj).sort((a, b) => {
    const valA = obj[a].currentVal || 0;
    const valB = obj[b].currentVal || 0;
    if (rowPartialOnTop) {
      if (obj[a].currentVal !== undefined && obj[b].currentVal === undefined) {
        return -1;
      }
      if (obj[b].currentVal !== undefined && obj[a].currentVal === undefined) {
        return 1;
      }
    }
    return objSort === 'asc' ? valA - valB : valB - valA;
  });

  const result = new Map<string, unknown>();
  sortedKeys.forEach(key => {
    const value = obj[key];
    if (typeof value === 'object' && !Array.isArray(value)) {
      result.set(
        key,
        sortHierarchicalObject(
          value as Record<string, HierarchicalNode>,
          objSort,
          rowPartialOnTop,
        ),
      );
    } else {
      result.set(key, value);
    }
  });
  return result;
}

function convertToArray(
  obj: Map<string, unknown>,
  rowEnabled: boolean | undefined,
  rowPartialOnTop: boolean | undefined,
  maxRowIndex: number,
  parentKeys: string[] = [],
  result: string[][] = [],
  flag = false,
): string[][] {
  // Recursively flattens a hierarchical Map structure into an array of key paths.
  // Handles different rendering scenarios based on row grouping configurations and
  // depth limitations. The function supports complex hierarchy flattening with
  let updatedFlag = flag;

  const keys = Array.from(obj.keys());
  const getValue = (key: string) => obj.get(key);

  keys.forEach(key => {
    if (key === 'currentVal') {
      return;
    }
    const value = getValue(key);
    if (rowEnabled && rowPartialOnTop && parentKeys.length < maxRowIndex - 1) {
      result.push(parentKeys.length > 0 ? [...parentKeys, key] : [key]);
      updatedFlag = true;
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      convertToArray(
        value as Map<string, unknown>,
        rowEnabled,
        rowPartialOnTop,
        maxRowIndex,
        [...parentKeys, key],
        result,
      );
    }
    if (
      parentKeys.length >= maxRowIndex - 1 ||
      (rowEnabled && !rowPartialOnTop)
    ) {
      if (!updatedFlag) {
        result.push(parentKeys.length > 0 ? [...parentKeys, key] : [key]);
        return;
      }
    }
    if (parentKeys.length === 0 && maxRowIndex === 1) {
      result.push([key]);
    }
  });
  return result;
}

export function TableRenderer({
  cols,
  rows,
  aggregatorName,
  tableOptions = {},
  subtotalOptions,
  namesMapping: namesMappingProp,
  onContextMenu,
  allowRenderHtml,
  ...restProps
}: TableRendererProps) {
  const [collapsedRows, setCollapsedRows] = useState<Record<string, boolean>>(
    {},
  );
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>(
    {},
  );
  const [sortingOrder, setSortingOrder] = useState<string[]>([]);
  const [activeSortColumn, setActiveSortColumn] = useState<number | null>(null);
  const [sortedRowKeys, setSortedRowKeys] = useState<string[][] | null>(null);

  const sortCacheRef = useRef(new Map<string, string[][]>());

  // Memoize props object to maintain referential stability
  const props = useMemo<TableRendererProps>(
    () => ({
      cols,
      rows,
      aggregatorName,
      tableOptions,
      subtotalOptions,
      namesMapping: namesMappingProp,
      onContextMenu,
      allowRenderHtml,
      ...restProps,
    }),
    [
      cols,
      rows,
      aggregatorName,
      tableOptions,
      subtotalOptions,
      namesMappingProp,
      onContextMenu,
      allowRenderHtml,
      restProps,
    ],
  );

  const clickHandler = useCallback(
    (
      pivotData: InstanceType<typeof PivotData>,
      rowValues: string[],
      colValues: string[],
    ) => {
      const colAttrs = cols;
      const rowAttrs = rows;
      const value = pivotData.getAggregator(rowValues, colValues).value();
      const filters: Record<string, string> = {};
      const colLimit = Math.min(colAttrs.length, colValues.length);
      for (let i = 0; i < colLimit; i += 1) {
        const attr = colAttrs[i];
        if (colValues[i] !== null) {
          filters[attr] = colValues[i];
        }
      }
      const rowLimit = Math.min(rowAttrs.length, rowValues.length);
      for (let i = 0; i < rowLimit; i += 1) {
        const attr = rowAttrs[i];
        if (rowValues[i] !== null) {
          filters[attr] = rowValues[i];
        }
      }
      const { clickCallback } = tableOptions;
      return (e: MouseEvent) => clickCallback?.(e, value, filters, pivotData);
    },
    [cols, rows, tableOptions],
  );

  const clickHeaderHandler = useCallback(
    (
      pivotData: InstanceType<typeof PivotData>,
      values: string[],
      attrs: string[],
      attrIdx: number,
      callback: HeaderClickCallback | undefined,
      isSubtotal = false,
      isGrandTotal = false,
    ) => {
      const filters: Record<string, string> = {};
      for (let i = 0; i <= attrIdx; i += 1) {
        const attr = attrs[i];
        filters[attr] = values[i];
      }
      return (e: MouseEvent) =>
        callback?.(
          e,
          values[attrIdx],
          filters,
          pivotData,
          isSubtotal,
          isGrandTotal,
        );
    },
    [],
  );

  const collapseAttr = useCallback(
    (rowOrCol: boolean, attrIdx: number, allKeys: string[][]) =>
      (e: MouseEvent<HTMLSpanElement>) => {
        // Collapse an entire attribute.
        e.stopPropagation();
        const keyLen = attrIdx + 1;
        const collapsed = allKeys
          .filter((k: string[]) => k.length === keyLen)
          .map(flatKey);

        const updates: Record<string, boolean> = {};
        collapsed.forEach((k: string) => {
          updates[k] = true;
        });

        if (rowOrCol) {
          setCollapsedRows(state => ({ ...state, ...updates }));
        } else {
          setCollapsedCols(state => ({ ...state, ...updates }));
        }
      },
    [],
  );

  const expandAttr = useCallback(
    (rowOrCol: boolean, attrIdx: number, allKeys: string[][]) =>
      (e: MouseEvent<HTMLSpanElement>) => {
        // Expand an entire attribute. This implicitly implies expanding all of the
        // parents as well. It's a bit inefficient but ah well...
        e.stopPropagation();
        const updates: Record<string, boolean> = {};
        allKeys.forEach((k: string[]) => {
          for (let i = 0; i <= attrIdx; i += 1) {
            updates[flatKey(k.slice(0, i + 1))] = false;
          }
        });

        if (rowOrCol) {
          setCollapsedRows(state => ({ ...state, ...updates }));
        } else {
          setCollapsedCols(state => ({ ...state, ...updates }));
        }
      },
    [],
  );

  const toggleRowKey = useCallback(
    (flatRowKey: string) => (e: MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      setCollapsedRows(state => ({
        ...state,
        [flatRowKey]: !state[flatRowKey],
      }));
    },
    [],
  );

  const toggleColKey = useCallback(
    (flatColKey: string) => (e: MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      setCollapsedCols(state => ({
        ...state,
        [flatColKey]: !state[flatColKey],
      }));
    },
    [],
  );

  const calcAttrSpans = useCallback((attrArr: string[][], numAttrs: number) => {
    // Given an array of attribute values (i.e. each element is another array with
    // the value at every level), compute the spans for every attribute value at
    // every level. The return value is a nested array of the same shape. It has
    // -1's for repeated values and the span number otherwise.

    const spans = [];
    // Index of the last new value
    const li = Array(numAttrs).map(() => 0);
    let lv: (string | null)[] = Array(numAttrs).map(() => null);
    for (let i = 0; i < attrArr.length; i += 1) {
      // Keep increasing span values as long as the last keys are the same. For
      // the rest, record spans of 1. Update the indices too.
      const cv = attrArr[i];
      const ent = [];
      let depth = 0;
      const limit = Math.min(lv.length, cv.length);
      while (depth < limit && lv[depth] === cv[depth]) {
        ent.push(-1);
        spans[li[depth]][depth] += 1;
        depth += 1;
      }
      while (depth < cv.length) {
        li[depth] = i;
        ent.push(1);
        depth += 1;
      }
      spans.push(ent);
      lv = cv;
    }
    return spans;
  }, []);

  const getAggregatedData = useCallback(
    (
      pivotData: InstanceType<typeof PivotData>,
      visibleColName: string[],
      rowPartialOnTop: boolean | undefined,
    ) => {
      // Transforms flat row keys into a hierarchical group structure where each level
      // represents a grouping dimension. For each row key path, it calculates the
      // aggregated value for the specified column and builds a nested object that
      // preserves the hierarchy while storing aggregation values at each level.
      const groups: Record<string, HierarchicalNode> = {};
      const rowsData = pivotData.rowKeys;
      rowsData.forEach(rowKey => {
        const aggValue =
          pivotData.getAggregator(rowKey, visibleColName).value() ?? 0;

        if (rowPartialOnTop) {
          const parent = rowKey
            .slice(0, -1)
            .reduce(
              (acc: Record<string, HierarchicalNode>, key: string) =>
                (acc[key] ??= {}) as Record<string, HierarchicalNode>,
              groups,
            );
          parent[rowKey.at(-1)!] = { currentVal: aggValue as number };
        } else {
          rowKey.reduce(
            (acc: Record<string, HierarchicalNode>, key: string) => {
              acc[key] = acc[key] || { currentVal: 0 };
              (acc[key] as HierarchicalNode).currentVal = aggValue as number;
              return acc[key] as Record<string, HierarchicalNode>;
            },
            groups,
          );
        }
      });
      return groups;
    },
    [],
  );

  const sortAndCacheData = useCallback(
    (
      groups: Record<string, HierarchicalNode>,
      sortOrder: string,
      rowEnabled: boolean | undefined,
      rowPartialOnTop: boolean | undefined,
      maxRowIndex: number,
    ) => {
      // Processes hierarchical data by first sorting it according to the specified order
      // and then converting the sorted structure into a flat array format. This function
      // serves as an intermediate step between hierarchical data representation and
      // flat array representation needed for rendering.
      const sortedGroups = sortHierarchicalObject(
        groups,
        sortOrder,
        rowPartialOnTop,
      );
      return convertToArray(
        sortedGroups,
        rowEnabled,
        rowPartialOnTop,
        maxRowIndex,
      );
    },
    [],
  );

  const getBasePivotSettings = useCallback((): PivotSettings => {
    // One-time extraction of pivot settings that we'll use throughout the render.

    const colAttrs = cols;
    const rowAttrs = rows;

    const mergedTableOptions: TableOptions = {
      rowTotals: true,
      colTotals: true,
      ...tableOptions,
    };
    const rowTotals = mergedTableOptions.rowTotals || colAttrs.length === 0;
    const colTotals = mergedTableOptions.colTotals || rowAttrs.length === 0;

    const namesMapping = namesMappingProp || {};
    const mergedSubtotalOptions: Required<
      Pick<SubtotalOptions, 'arrowCollapsed' | 'arrowExpanded'>
    > &
      SubtotalOptions = {
      arrowCollapsed: '\u25B2',
      arrowExpanded: '\u25BC',
      ...subtotalOptions,
    };

    const colSubtotalDisplay: SubtotalDisplay = {
      displayOnTop: false,
      enabled: mergedTableOptions.colSubTotals,
      hideOnExpand: false,
      ...mergedSubtotalOptions.colSubtotalDisplay,
    };

    const rowSubtotalDisplay: SubtotalDisplay = {
      displayOnTop: false,
      enabled: mergedTableOptions.rowSubTotals,
      hideOnExpand: false,
      ...mergedSubtotalOptions.rowSubtotalDisplay,
    };

    const pivotData = new PivotData(props as Record<string, unknown>, {
      rowEnabled: rowSubtotalDisplay.enabled,
      colEnabled: colSubtotalDisplay.enabled,
      rowPartialOnTop: rowSubtotalDisplay.displayOnTop,
      colPartialOnTop: colSubtotalDisplay.displayOnTop,
    });
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();

    // Also pre-calculate all the callbacks for cells, etc... This is nice to have to
    // avoid re-calculations of the call-backs on cell expansions, etc...
    const cellCallbacks: Record<
      string,
      Record<string, (e: MouseEvent) => void>
    > = {};
    const rowTotalCallbacks: Record<string, (e: MouseEvent) => void> = {};
    const colTotalCallbacks: Record<string, (e: MouseEvent) => void> = {};
    let grandTotalCallback: ((e: MouseEvent) => void) | null = null;
    if (mergedTableOptions.clickCallback) {
      rowKeys.forEach(rowKey => {
        const flatRowKey = flatKey(rowKey);
        if (!(flatRowKey in cellCallbacks)) {
          cellCallbacks[flatRowKey] = {};
        }
        colKeys.forEach(colKey => {
          cellCallbacks[flatRowKey][flatKey(colKey)] = clickHandler(
            pivotData,
            rowKey,
            colKey,
          );
        });
      });

      // Add in totals as well.
      if (rowTotals) {
        rowKeys.forEach(rowKey => {
          rowTotalCallbacks[flatKey(rowKey)] = clickHandler(
            pivotData,
            rowKey,
            [],
          );
        });
      }
      if (colTotals) {
        colKeys.forEach(colKey => {
          colTotalCallbacks[flatKey(colKey)] = clickHandler(
            pivotData,
            [],
            colKey,
          );
        });
      }
      if (rowTotals && colTotals) {
        grandTotalCallback = clickHandler(pivotData, [], []);
      }
    }

    return {
      pivotData,
      colAttrs,
      rowAttrs,
      colKeys,
      rowKeys,
      rowTotals,
      colTotals,
      arrowCollapsed: mergedSubtotalOptions.arrowCollapsed,
      arrowExpanded: mergedSubtotalOptions.arrowExpanded,
      colSubtotalDisplay,
      rowSubtotalDisplay,
      cellCallbacks,
      rowTotalCallbacks,
      colTotalCallbacks,
      grandTotalCallback,
      namesMapping,
      allowRenderHtml,
    };
  }, [
    cols,
    rows,
    tableOptions,
    namesMappingProp,
    subtotalOptions,
    props,
    allowRenderHtml,
    clickHandler,
  ]);

  const visibleKeys = useCallback(
    (
      keys: string[][],
      collapsed: Record<string, boolean>,
      numAttrs: number,
      subtotalDisplay: SubtotalDisplay,
    ) =>
      keys.filter(
        (key: string[]) =>
          // Is the key hidden by one of its parents?
          !key.some(
            (_k: string, j: number) => collapsed[flatKey(key.slice(0, j))],
          ) &&
          // Leaf key.
          (key.length === numAttrs ||
            // Children hidden. Must show total.
            flatKey(key) in collapsed ||
            // Don't hide totals.
            !subtotalDisplay.hideOnExpand),
      ),
    [],
  );

  const isDashboardEditMode = useCallback(
    () => document.contains(document.querySelector('.dashboard--editing')),
    [],
  );

  // Compute base pivot settings, memoized based on relevant props
  const basePivotSettings = useMemo(() => {
    // Clear sort cache when props change
    sortCacheRef.current.clear();
    return getBasePivotSettings();
  }, [getBasePivotSettings]);

  // Reset sort state when structural props change
  useEffect(() => {
    setSortingOrder([]);
    setActiveSortColumn(null);
    setSortedRowKeys(null);
  }, [
    cols,
    rows,
    aggregatorName,
    tableOptions,
    subtotalOptions,
    namesMappingProp,
    allowRenderHtml,
  ]);

  // Use sorted row keys if available, otherwise use base row keys
  const effectiveRowKeys = sortedRowKeys ?? basePivotSettings.rowKeys;

  const {
    colAttrs,
    rowAttrs,
    colKeys,
    colTotals,
    rowSubtotalDisplay,
    colSubtotalDisplay,
  } = basePivotSettings;

  const rowKeys = effectiveRowKeys;

  // Need to account for exclusions to compute the effective row
  // and column keys.
  const visibleRowKeys = visibleKeys(
    rowKeys,
    collapsedRows,
    rowAttrs.length,
    rowSubtotalDisplay,
  );
  const visibleColKeys = visibleKeys(
    colKeys,
    collapsedCols,
    colAttrs.length,
    colSubtotalDisplay,
  );

  const pivotSettings: PivotSettings = {
    visibleRowKeys,
    maxRowVisible: Math.max(...visibleRowKeys.map((k: string[]) => k.length)),
    visibleColKeys,
    maxColVisible: Math.max(...visibleColKeys.map((k: string[]) => k.length)),
    rowAttrSpans: calcAttrSpans(visibleRowKeys, rowAttrs.length),
    colAttrSpans: calcAttrSpans(visibleColKeys, colAttrs.length),
    allowRenderHtml,
    ...basePivotSettings,
  };

  const sortData = useCallback(
    (
      columnIndex: number,
      visColKeys: string[][],
      pivotData: InstanceType<typeof PivotData>,
      maxRowIndex: number,
    ) => {
      // Handles column sorting with direction toggling (asc/desc) and implements
      // caching mechanism to avoid redundant sorting operations. When sorting the same
      // column multiple times, it cycles through sorting directions. Uses composite
      // cache keys based on sorting parameters for optimal performance.
      const newSortingOrder: string[] = [];
      let newDirection = 'asc';

      if (activeSortColumn === columnIndex) {
        newDirection = sortingOrder[columnIndex] === 'asc' ? 'desc' : 'asc';
      }

      const { rowEnabled, rowPartialOnTop } = pivotData.subtotals as {
        rowEnabled?: boolean;
        rowPartialOnTop?: boolean;
      };
      newSortingOrder[columnIndex] = newDirection;

      const cacheKey = `${columnIndex}-${visColKeys.length}-${rowEnabled}-${rowPartialOnTop}-${newDirection}`;
      let newRowKeys;
      if (sortCacheRef.current.has(cacheKey)) {
        const cachedRowKeys = sortCacheRef.current.get(cacheKey);
        newRowKeys = cachedRowKeys;
      } else {
        const groups = getAggregatedData(
          pivotData,
          visColKeys[columnIndex],
          rowPartialOnTop,
        );
        const computedSortedRowKeys = sortAndCacheData(
          groups,
          newDirection,
          rowEnabled,
          rowPartialOnTop,
          maxRowIndex,
        );
        sortCacheRef.current.set(cacheKey, computedSortedRowKeys);
        newRowKeys = computedSortedRowKeys;
      }

      setSortedRowKeys(newRowKeys!);
      setSortingOrder(newSortingOrder);
      setActiveSortColumn(columnIndex);
    },
    [activeSortColumn, sortingOrder, getAggregatedData, sortAndCacheData],
  );

  const renderColHeaderRow = useCallback(
    (attrName: string, attrIdx: number, settings: PivotSettings) => {
      // Render a single row in the column header at the top of the pivot table.

      const {
        rowAttrs: settingsRowAttrs,
        colAttrs: settingsColAttrs,
        colKeys: settingsColKeys,
        visibleColKeys: settingsVisibleColKeys,
        colAttrSpans,
        rowTotals,
        arrowExpanded,
        arrowCollapsed,
        colSubtotalDisplay: settingsColSubtotalDisplay,
        maxColVisible,
        pivotData,
        namesMapping,
        allowRenderHtml: settingsAllowRenderHtml,
      } = settings;
      const {
        highlightHeaderCellsOnHover,
        omittedHighlightHeaderGroups = [],
        highlightedHeaderCells,
        dateFormatters,
      } = tableOptions;

      if (!settingsVisibleColKeys || !colAttrSpans) {
        return null;
      }

      const spaceCell =
        attrIdx === 0 && settingsRowAttrs.length !== 0 ? (
          <th
            key="padding"
            colSpan={settingsRowAttrs.length}
            rowSpan={settingsColAttrs.length}
            aria-hidden="true"
          />
        ) : null;

      const needToggle =
        settingsColSubtotalDisplay.enabled === true &&
        attrIdx !== settingsColAttrs.length - 1;
      let arrowClickHandle = null;
      let subArrow = null;
      if (needToggle) {
        arrowClickHandle =
          attrIdx + 1 < maxColVisible!
            ? collapseAttr(false, attrIdx, settingsColKeys)
            : expandAttr(false, attrIdx, settingsColKeys);
        subArrow =
          attrIdx + 1 < maxColVisible! ? arrowExpanded : arrowCollapsed;
      }
      const attrNameCell = (
        <th key="label" className="pvtAxisLabel">
          {displayHeaderCell(
            needToggle,
            subArrow,
            arrowClickHandle,
            attrName,
            namesMapping,
            settingsAllowRenderHtml,
          )}
        </th>
      );

      const attrValueCells = [];
      const rowIncrSpan = settingsRowAttrs.length !== 0 ? 1 : 0;
      // Iterate through columns. Jump over duplicate values.
      let i = 0;
      while (i < settingsVisibleColKeys.length) {
        let handleContextMenu: ((e: MouseEvent) => void) | undefined;
        const colKey = settingsVisibleColKeys[i];
        const colSpan = attrIdx < colKey.length ? colAttrSpans[i][attrIdx] : 1;
        let colLabelClass = 'pvtColLabel';
        if (attrIdx < colKey.length) {
          if (
            !omittedHighlightHeaderGroups.includes(settingsColAttrs[attrIdx])
          ) {
            if (highlightHeaderCellsOnHover) {
              colLabelClass += ' hoverable';
            }
            handleContextMenu = (e: MouseEvent) =>
              onContextMenu(e, colKey, undefined, {
                [attrName]: colKey[attrIdx],
              });
          }
          if (
            highlightedHeaderCells &&
            Array.isArray(highlightedHeaderCells[settingsColAttrs[attrIdx]]) &&
            highlightedHeaderCells[settingsColAttrs[attrIdx]].includes(
              colKey[attrIdx],
            )
          ) {
            colLabelClass += ' active';
          }
          const maxRowIndex = settings.maxRowVisible!;
          const mColVisible = settings.maxColVisible!;
          const visibleSortIcon = mColVisible - 1 === attrIdx;
          const columnName = colKey[mColVisible - 1];

          const rowSpan =
            1 + (attrIdx === settingsColAttrs.length - 1 ? rowIncrSpan : 0);
          const flatColKey = flatKey(colKey.slice(0, attrIdx + 1));
          const onArrowClick = needToggle ? toggleColKey(flatColKey) : null;
          const getSortIcon = (key: number) => {
            if (activeSortColumn !== key) {
              return (
                <FaSort
                  onClick={() =>
                    sortData(
                      key,
                      settingsVisibleColKeys,
                      pivotData,
                      maxRowIndex,
                    )
                  }
                />
              );
            }

            const SortIcon =
              sortingOrder[key] === 'asc' ? FaSortAsc : FaSortDesc;
            return (
              <SortIcon
                onClick={() =>
                  sortData(key, settingsVisibleColKeys, pivotData, maxRowIndex)
                }
              />
            );
          };
          const headerCellFormattedValue =
            dateFormatters?.[attrName]?.(colKey[attrIdx]) ?? colKey[attrIdx];
          attrValueCells.push(
            <th
              className={colLabelClass}
              key={`colKey-${flatColKey}`}
              colSpan={colSpan}
              rowSpan={rowSpan}
              role="columnheader button"
              onClick={clickHeaderHandler(
                pivotData,
                colKey,
                cols,
                attrIdx,
                tableOptions.clickColumnHeaderCallback,
              )}
              onContextMenu={handleContextMenu}
            >
              {displayHeaderCell(
                needToggle,
                collapsedCols[flatColKey] ? arrowCollapsed : arrowExpanded,
                onArrowClick,
                headerCellFormattedValue,
                namesMapping,
                settingsAllowRenderHtml,
              )}
              <span
                role="columnheader"
                tabIndex={0}
                // Prevents event bubbling to avoid conflict with column header click handlers
                // Ensures sort operation executes without triggering cross-filtration
                onClick={e => {
                  e.stopPropagation();
                }}
                aria-label={
                  activeSortColumn === i
                    ? `Sorted by ${columnName} ${sortingOrder[i] === 'asc' ? 'ascending' : 'descending'}`
                    : undefined
                }
              >
                {visibleSortIcon && getSortIcon(i)}
              </span>
            </th>,
          );
        } else if (attrIdx === colKey.length) {
          const rowSpan = settingsColAttrs.length - colKey.length + rowIncrSpan;
          attrValueCells.push(
            <th
              className={`${colLabelClass} pvtSubtotalLabel`}
              key={`colKeyBuffer-${flatKey(colKey)}`}
              colSpan={colSpan}
              rowSpan={rowSpan}
              role="columnheader button"
              onClick={clickHeaderHandler(
                pivotData,
                colKey,
                cols,
                attrIdx,
                tableOptions.clickColumnHeaderCallback,
                true,
              )}
            >
              {t('Subtotal')}
            </th>,
          );
        }
        // The next colSpan columns will have the same value anyway...
        i += colSpan;
      }

      const totalCell =
        attrIdx === 0 && rowTotals ? (
          <th
            key="total"
            className="pvtTotalLabel"
            rowSpan={
              settingsColAttrs.length + Math.min(settingsRowAttrs.length, 1)
            }
            role="columnheader button"
            onClick={clickHeaderHandler(
              pivotData,
              [],
              cols,
              attrIdx,
              tableOptions.clickColumnHeaderCallback,
              false,
              true,
            )}
          >
            {t('Total (%(aggregatorName)s)', {
              aggregatorName: t(aggregatorName),
            })}
          </th>
        ) : null;

      const cells = [spaceCell, attrNameCell, ...attrValueCells, totalCell];
      return <tr key={`colAttr-${attrIdx}`}>{cells}</tr>;
    },
    [
      tableOptions,
      onContextMenu,
      collapseAttr,
      expandAttr,
      toggleColKey,
      clickHeaderHandler,
      cols,
      aggregatorName,
      activeSortColumn,
      sortingOrder,
      collapsedCols,
      sortData,
    ],
  );

  const renderRowHeaderRow = useCallback(
    (settings: PivotSettings) => {
      // Render just the attribute names of the rows (the actual attribute values
      // will show up in the individual rows).

      const {
        rowAttrs: settingsRowAttrs,
        colAttrs: settingsColAttrs,
        rowKeys: settingsRowKeys,
        arrowCollapsed,
        arrowExpanded,
        rowSubtotalDisplay: settingsRowSubtotalDisplay,
        maxRowVisible,
        pivotData,
        namesMapping,
        allowRenderHtml: settingsAllowRenderHtml,
      } = settings;
      return (
        <tr key="rowHdr">
          {settingsRowAttrs.map((r, i) => {
            const needLabelToggle =
              settingsRowSubtotalDisplay.enabled === true &&
              i !== settingsRowAttrs.length - 1;
            let arrowClickHandle = null;
            let subArrow = null;
            if (needLabelToggle) {
              arrowClickHandle =
                i + 1 < maxRowVisible!
                  ? collapseAttr(true, i, settingsRowKeys)
                  : expandAttr(true, i, settingsRowKeys);
              subArrow =
                i + 1 < maxRowVisible! ? arrowExpanded : arrowCollapsed;
            }
            return (
              <th className="pvtAxisLabel" key={`rowAttr-${i}`}>
                {displayHeaderCell(
                  needLabelToggle,
                  subArrow,
                  arrowClickHandle,
                  r,
                  namesMapping,
                  settingsAllowRenderHtml,
                )}
              </th>
            );
          })}
          <th
            className="pvtTotalLabel"
            key="padding"
            role="columnheader button"
            onClick={clickHeaderHandler(
              pivotData,
              [],
              rows,
              0,
              tableOptions.clickRowHeaderCallback,
              false,
              true,
            )}
          >
            {settingsColAttrs.length === 0
              ? t('Total (%(aggregatorName)s)', {
                  aggregatorName: t(aggregatorName),
                })
              : null}
          </th>
        </tr>
      );
    },
    [
      collapseAttr,
      expandAttr,
      clickHeaderHandler,
      rows,
      tableOptions.clickRowHeaderCallback,
      aggregatorName,
    ],
  );

  const renderTableRow = useCallback(
    (rowKey: string[], rowIdx: number, settings: PivotSettings) => {
      // Render a single row in the pivot table.

      const {
        rowAttrs: settingsRowAttrs,
        colAttrs: settingsColAttrs,
        rowAttrSpans,
        visibleColKeys: settingsVisibleColKeys,
        pivotData,
        rowTotals,
        rowSubtotalDisplay: settingsRowSubtotalDisplay,
        arrowExpanded,
        arrowCollapsed,
        cellCallbacks,
        rowTotalCallbacks,
        namesMapping,
        allowRenderHtml: settingsAllowRenderHtml,
      } = settings;

      const {
        highlightHeaderCellsOnHover,
        omittedHighlightHeaderGroups = [],
        highlightedHeaderCells,
        cellColorFormatters,
        dateFormatters,
      } = tableOptions;
      const flatRowKey = flatKey(rowKey);

      const colIncrSpan = settingsColAttrs.length !== 0 ? 1 : 0;
      const attrValueCells = rowKey.map((r: string, i: number) => {
        let handleContextMenu: ((e: MouseEvent) => void) | undefined;
        let valueCellClassName = 'pvtRowLabel';
        if (!omittedHighlightHeaderGroups.includes(settingsRowAttrs[i])) {
          if (highlightHeaderCellsOnHover) {
            valueCellClassName += ' hoverable';
          }
          handleContextMenu = (e: MouseEvent) =>
            onContextMenu(e, undefined, rowKey, {
              [settingsRowAttrs[i]]: r,
            });
        }
        if (
          highlightedHeaderCells &&
          Array.isArray(highlightedHeaderCells[settingsRowAttrs[i]]) &&
          highlightedHeaderCells[settingsRowAttrs[i]].includes(r)
        ) {
          valueCellClassName += ' active';
        }
        const rowSpan = rowAttrSpans![rowIdx][i];
        if (rowSpan > 0) {
          const flatRowKeySlice = flatKey(rowKey.slice(0, i + 1));
          const colSpan =
            1 + (i === settingsRowAttrs.length - 1 ? colIncrSpan : 0);
          const needRowToggle =
            settingsRowSubtotalDisplay.enabled === true &&
            i !== settingsRowAttrs.length - 1;
          const onArrowClick = needRowToggle
            ? toggleRowKey(flatRowKeySlice)
            : null;

          const headerCellFormattedValue =
            dateFormatters?.[settingsRowAttrs[i]]?.(r) ?? r;
          return (
            <th
              key={`rowKeyLabel-${i}`}
              className={valueCellClassName}
              rowSpan={rowSpan}
              colSpan={colSpan}
              role="columnheader button"
              onClick={clickHeaderHandler(
                pivotData,
                rowKey,
                rows,
                i,
                tableOptions.clickRowHeaderCallback,
              )}
              onContextMenu={handleContextMenu}
            >
              {displayHeaderCell(
                needRowToggle,
                collapsedRows[flatRowKeySlice] ? arrowCollapsed : arrowExpanded,
                onArrowClick,
                headerCellFormattedValue,
                namesMapping,
                settingsAllowRenderHtml,
              )}
            </th>
          );
        }
        return null;
      });

      const attrValuePaddingCell =
        rowKey.length < settingsRowAttrs.length ? (
          <th
            className="pvtRowLabel pvtSubtotalLabel"
            key="rowKeyBuffer"
            colSpan={settingsRowAttrs.length - rowKey.length + colIncrSpan}
            rowSpan={1}
            role="columnheader button"
            onClick={clickHeaderHandler(
              pivotData,
              rowKey,
              rows,
              rowKey.length,
              tableOptions.clickRowHeaderCallback,
              true,
            )}
          >
            {t('Subtotal')}
          </th>
        ) : null;

      if (!settingsVisibleColKeys) {
        return null;
      }

      const rowClickHandlers = cellCallbacks[flatRowKey] || {};
      const valueCells = settingsVisibleColKeys.map((colKey: string[]) => {
        const flatColKey = flatKey(colKey);
        const agg = pivotData.getAggregator(rowKey, colKey);
        const aggValue = agg.value();

        const keys = [...rowKey, ...colKey];
        let backgroundColor: string | undefined;
        if (cellColorFormatters) {
          Object.values(cellColorFormatters).forEach(cellColorFormatter => {
            if (Array.isArray(cellColorFormatter)) {
              keys.forEach(key => {
                if (backgroundColor) {
                  return;
                }
                cellColorFormatter
                  .filter(formatter => formatter.column === key)
                  .forEach(formatter => {
                    const formatterResult =
                      formatter.getColorFromValue(aggValue);
                    if (formatterResult) {
                      backgroundColor = formatterResult;
                    }
                  });
              });
            }
          });
        }

        const style = agg.isSubtotal
          ? { fontWeight: 'bold' }
          : { backgroundColor };

        return (
          <td
            role="gridcell"
            className="pvtVal"
            key={`pvtVal-${flatColKey}`}
            onClick={rowClickHandlers[flatColKey]}
            onContextMenu={e => onContextMenu(e, colKey, rowKey)}
            style={style}
          >
            {displayCell(agg.format(aggValue, agg), settingsAllowRenderHtml)}
          </td>
        );
      });

      let totalCell = null;
      if (rowTotals) {
        const agg = pivotData.getAggregator(rowKey, []);
        const aggValue = agg.value();
        totalCell = (
          <td
            role="gridcell"
            key="total"
            className="pvtTotal"
            onClick={rowTotalCallbacks[flatRowKey]}
            onContextMenu={e => onContextMenu(e, undefined, rowKey)}
          >
            {displayCell(agg.format(aggValue, agg), settingsAllowRenderHtml)}
          </td>
        );
      }

      const rowCells = [
        ...attrValueCells,
        attrValuePaddingCell,
        ...valueCells,
        totalCell,
      ];

      return <tr key={`keyRow-${flatRowKey}`}>{rowCells}</tr>;
    },
    [
      tableOptions,
      onContextMenu,
      toggleRowKey,
      clickHeaderHandler,
      rows,
      collapsedRows,
    ],
  );

  const renderTotalsRow = useCallback(
    (settings: PivotSettings) => {
      // Render the final totals rows that has the totals for all the columns.

      const {
        rowAttrs: settingsRowAttrs,
        colAttrs: settingsColAttrs,
        visibleColKeys: settingsVisibleColKeys,
        rowTotals,
        pivotData,
        colTotalCallbacks,
        grandTotalCallback,
      } = settings;

      if (!settingsVisibleColKeys) {
        return null;
      }

      const totalLabelCell = (
        <th
          key="label"
          className="pvtTotalLabel pvtRowTotalLabel"
          colSpan={
            settingsRowAttrs.length + Math.min(settingsColAttrs.length, 1)
          }
          role="columnheader button"
          onClick={clickHeaderHandler(
            pivotData,
            [],
            rows,
            0,
            tableOptions.clickRowHeaderCallback,
            false,
            true,
          )}
        >
          {t('Total (%(aggregatorName)s)', {
            aggregatorName: t(aggregatorName),
          })}
        </th>
      );

      const totalValueCells = settingsVisibleColKeys.map((colKey: string[]) => {
        const flatColKey = flatKey(colKey);
        const agg = pivotData.getAggregator([], colKey);
        const aggValue = agg.value();

        return (
          <td
            role="gridcell"
            className="pvtTotal pvtRowTotal"
            key={`total-${flatColKey}`}
            onClick={colTotalCallbacks[flatColKey]}
            onContextMenu={e => onContextMenu(e, colKey, undefined)}
            style={{ padding: '5px' }}
          >
            {displayCell(agg.format(aggValue, agg), allowRenderHtml)}
          </td>
        );
      });

      let grandTotalCell = null;
      if (rowTotals) {
        const agg = pivotData.getAggregator([], []);
        const aggValue = agg.value();
        grandTotalCell = (
          <td
            role="gridcell"
            key="total"
            className="pvtGrandTotal pvtRowTotal"
            onClick={grandTotalCallback || undefined}
            onContextMenu={e => onContextMenu(e, undefined, undefined)}
          >
            {displayCell(agg.format(aggValue, agg), allowRenderHtml)}
          </td>
        );
      }

      const totalCells = [totalLabelCell, ...totalValueCells, grandTotalCell];

      return (
        <tr key="total" className="pvtRowTotals">
          {totalCells}
        </tr>
      );
    },
    [
      clickHeaderHandler,
      rows,
      tableOptions.clickRowHeaderCallback,
      aggregatorName,
      onContextMenu,
      allowRenderHtml,
    ],
  );

  return (
    <Styles isDashboardEditMode={isDashboardEditMode()}>
      <table className="pvtTable" role="grid">
        <thead>
          {colAttrs.map((c: string, j: number) =>
            renderColHeaderRow(c, j, pivotSettings),
          )}
          {rowAttrs.length !== 0 && renderRowHeaderRow(pivotSettings)}
        </thead>
        <tbody>
          {visibleRowKeys.map((r: string[], i: number) =>
            renderTableRow(r, i, pivotSettings),
          )}
          {colTotals && renderTotalsRow(pivotSettings)}
        </tbody>
      </table>
    </Styles>
  );
}

TableRenderer.propTypes = {
  ...PivotData.propTypes,
  tableOptions: PropTypes.object,
  onContextMenu: PropTypes.func,
};
TableRenderer.defaultProps = { ...PivotData.defaultProps, tableOptions: {} };
