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
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core/translation';
import { styled, css, SupersetTheme } from '@apache-superset/core/theme';
import { Icons, Button, InfoTooltip } from '@superset-ui/core/components';
import { FilterValue } from 'react-table';
import Table, {
  type ColumnsType,
  type SortOrder,
  type SorterResult,
  type TablePaginationConfig,
  TableSize,
} from '@superset-ui/core/components/Table';
import Fieldset, { type FieldsetProps } from '../Fieldset';
import { recurseReactClone } from '../../utils';
import {
  type CRUDCollectionProps,
  type Sort,
  SortOrder as SortOrderEnum,
} from '../../types';

const CrudButtonWrapper = styled.div`
  text-align: right;
  ${({ theme }) => `margin-bottom: ${theme.sizeUnit * 2}px`}
`;

const StyledButtonWrapper = styled.span`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 3}px;
    margin-left: ${theme.sizeUnit * 3}px;
    button>span>:first-of-type {
      margin-right: 0;
    }
  `}
`;

type CollectionItem = { id: string | number; [key: string]: unknown };

function createKeyedCollection(arr: Array<object>) {
  const collectionArray = arr.map(
    (o: Record<string, unknown>) =>
      ({
        ...o,
        id: o.id != null ? o.id : nanoid(),
      }) as CollectionItem,
  );

  return collectionArray;
}

export default function CRUDCollection({
  allowAddItem = false,
  allowDeletes = false,
  collection: propsCollection,
  columnLabels,
  columnLabelTooltips,
  emptyMessage = t('No items'),
  expandFieldset,
  itemGenerator,
  itemCellProps,
  itemRenderers,
  onChange,
  tableColumns,
  sortColumns = [],
  stickyHeader = false,
  pagination = false,
  filterTerm,
  filterFields,
}: CRUDCollectionProps) {
  const [expandedColumns, setExpandedColumns] = useState<
    Record<PropertyKey, boolean>
  >({});
  // Seed ids for the first render; the props-sync effect re-keys on each
  // collection prop change.
  const initialKeyed = useRef<ReturnType<typeof createKeyedCollection>>();
  if (!initialKeyed.current) {
    initialKeyed.current = createKeyedCollection(propsCollection);
  }
  const [collectionArray, setCollectionArray] = useState<CollectionItem[]>(
    () => initialKeyed.current!,
  );
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sort, setSort] = useState<SortOrderEnum>(SortOrderEnum.Unsorted);
  // Controlled pagination: tracked so that filtering can clamp currentPage
  // back to a valid page (avoids the user being stranded on an empty page
  // when filterTerm shrinks the result set).
  const [pageSize, setPageSize] = useState<number>(() =>
    typeof pagination === 'object' && pagination?.pageSize
      ? pagination.pageSize
      : 10,
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  // The row order to restore when a sort is cleared. Tracked from
  // collectionArray itself (not propsCollection) so it reflects in-progress
  // edits whose onChange round trip to the parent hasn't landed back in
  // props yet.
  const unsortedOrderRef = useRef<Array<string | number>>(
    initialKeyed.current!.map(item => item.id),
  );

  const sortRef = useRef<SortOrderEnum>(SortOrderEnum.Unsorted);
  sortRef.current = sort;
  const collectionArrayRef = useRef<CollectionItem[]>(collectionArray);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fieldChangeHandlers = useRef(
    new Map<
      CollectionItem['id'],
      NonNullable<FieldsetProps['onFieldChange']>
    >(),
  );

  const setCurrentCollection = useCallback((items: CollectionItem[]) => {
    // Advance before notifying the parent so queued edits share the same rows.
    collectionArrayRef.current = items;
    const ids = new Set(items.map(item => item.id));
    fieldChangeHandlers.current.forEach((_handler, id) => {
      if (!ids.has(id)) fieldChangeHandlers.current.delete(id);
    });
    if (sortRef.current === SortOrderEnum.Unsorted) {
      unsortedOrderRef.current = items.map(item => item.id);
    }
    setCollectionArray(items);
  }, []);

  const changeCollection = useCallback(
    (items: CollectionItem[]) => {
      setCurrentCollection(items);
      onChangeRef.current?.(items);
    },
    [setCurrentCollection],
  );

  // Sync with props.collection changes
  useEffect(() => {
    const newCollectionArray = createKeyedCollection(propsCollection);
    // Refresh the restore order too, so that clearing a sort after an
    // external sync (e.g. a source-control-synced column set) reflects the
    // synced order and row set instead of stale, pre-sync ids.
    // While sorted, a sync whose row order matches what is already displayed
    // is the parent echoing back our own sorted onChange; it must not
    // overwrite the restore order with the sorted order. Any other sync is
    // external and defines the new restore order.
    const newIds = newCollectionArray.map(item => item.id);
    const displayedIds = collectionArrayRef.current.map(item => item.id);
    const isEcho =
      sortRef.current !== SortOrderEnum.Unsorted &&
      newIds.length === displayedIds.length &&
      newIds.every((id, i) => id === displayedIds[i]);
    if (!isEcho) {
      unsortedOrderRef.current = newIds;
    }
    setCurrentCollection(newCollectionArray);
  }, [propsCollection, setCurrentCollection]);

  const onCellChange = useCallback(
    (id: string | number, col: string | number, val: unknown) => {
      const items = collectionArrayRef.current;
      // A delayed control callback must not restore a deleted row.
      if (!items.some(item => item.id === id)) return;
      changeCollection(
        items.map(item => (item.id === id ? { ...item, [col]: val } : item)),
      );
    },
    [changeCollection],
  );

  const deleteItem = useCallback(
    (id: string | number) => {
      changeCollection(
        collectionArrayRef.current.filter(item => item.id !== id),
      );
    },
    [changeCollection],
  );

  const onAddItem = useCallback(() => {
    if (itemGenerator) {
      let newItem = itemGenerator() as CollectionItem;
      const shouldStartExpanded = newItem.expanded === true;
      if (newItem.id == null) {
        newItem = { ...newItem, id: nanoid() };
      }
      delete newItem.expanded;

      changeCollection([newItem, ...collectionArrayRef.current]);

      if (shouldStartExpanded) {
        setExpandedColumns(prev => ({ ...prev, [newItem.id]: true }));
      }
    }
  }, [itemGenerator, changeCollection]);

  const getLabel = useCallback(
    (col: string): string => {
      let label = columnLabels?.[col] ? columnLabels[col] : col;
      if (label.startsWith('__')) {
        label = '';
      }
      return label;
    },
    [columnLabels],
  );

  const getTooltip = useCallback(
    (col: string): string | undefined => columnLabelTooltips?.[col],
    [columnLabelTooltips],
  );

  const toggleExpand = useCallback((id: string | number) => {
    setExpandedColumns(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleTableChange = useCallback(
    (
      paginationEvt: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<CollectionItem> | SorterResult<CollectionItem>[],
    ) => {
      if (
        paginationEvt.current !== undefined &&
        paginationEvt.pageSize !== undefined
      ) {
        setCurrentPage(paginationEvt.current);
        setPageSize(paginationEvt.pageSize);
      }
      const columnSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      let newSortColumn = '';
      let newSortOrder = SortOrderEnum.Unsorted;

      if (columnSorter?.columnKey && columnSorter?.order) {
        newSortColumn = columnSorter.columnKey as string;
        newSortOrder =
          columnSorter.order === 'ascend'
            ? SortOrderEnum.Asc
            : SortOrderEnum.Desc;
      }

      const col = newSortColumn;

      // A pagination or page-size change re-emits the current sorter. The
      // rows are already ordered, so re-sorting would only churn tie order.
      if (newSortColumn === sortColumn && newSortOrder === sort) {
        return;
      }

      if (
        sortColumns?.includes(col) ||
        newSortOrder === SortOrderEnum.Unsorted
      ) {
        let sortedArray: CollectionItem[];

        if (newSortOrder !== SortOrderEnum.Unsorted) {
          const compareSort = (m: Sort, n: Sort) => {
            if (typeof m === 'string' && typeof n === 'string') {
              return (m || '').localeCompare(n || '');
            }
            if (typeof m === 'number' && typeof n === 'number') {
              return m - n;
            }
            if (typeof m === 'boolean' && typeof n === 'boolean') {
              return m === n ? 0 : m ? 1 : -1;
            }
            const mStr = String(m ?? '');
            const nStr = String(n ?? '');
            return mStr.localeCompare(nStr);
          };

          // Sort the live, edited collection rather than propsCollection, so
          // an edit that hasn't round-tripped back through onChange yet
          // isn't dropped when a sort is applied.
          sortedArray = [...collectionArrayRef.current];
          // Negate the comparator for descending order (rather than reversing
          // the array) so equal-key rows keep their relative order.
          const direction = newSortOrder === SortOrderEnum.Desc ? -1 : 1;
          sortedArray.sort(
            (a: CollectionItem, b: CollectionItem) =>
              direction * compareSort(a[col] as Sort, b[col] as Sort),
          );
        } else {
          // Restore the pre-sort order using the latest row values. Any row
          // added while sorted is appended after the tracked rows.
          const itemsById = new Map(
            collectionArrayRef.current.map(item => [item.id, item]),
          );
          const trackedIds = new Set(unsortedOrderRef.current);
          sortedArray = unsortedOrderRef.current.flatMap(id => {
            const item = itemsById.get(id);
            return item ? [item] : [];
          });
          collectionArrayRef.current.forEach(item => {
            if (!trackedIds.has(item.id)) {
              sortedArray.push(item);
            }
          });
        }

        sortRef.current = newSortOrder;
        setCurrentCollection(sortedArray);
        setSortColumn(newSortColumn);
        setSort(newSortOrder);
      }
    },
    [setCurrentCollection, sortColumns, sortColumn, sort],
  );

  const renderExpandableSection = useCallback(
    (item: CollectionItem): ReactNode => {
      const { id } = item;
      // SQL controls cancel their pending debounce when this callback changes.
      // Keep each row's handler stable across collection edits and expansion.
      if (!fieldChangeHandlers.current.has(id)) {
        fieldChangeHandlers.current.set(id, (fieldKey, value) =>
          onCellChange(id, fieldKey, value),
        );
      }
      const propsGenerator = () => ({
        item,
        onFieldChange: fieldChangeHandlers.current.get(id),
      });
      return recurseReactClone(expandFieldset, Fieldset, propsGenerator);
    },
    [expandFieldset, onCellChange],
  );

  const renderCell = useCallback(
    (record: CollectionItem, col: string): ReactNode => {
      const renderer = itemRenderers?.[col];
      const val = record[col];
      const cellOnChange = (newVal: unknown) =>
        onCellChange(record.id, col, newVal);
      return renderer
        ? renderer(val, cellOnChange, getLabel(col), record)
        : (val as ReactNode);
    },
    [itemRenderers, onCellChange, getLabel],
  );

  const antdColumns = useMemo((): ColumnsType<CollectionItem> => {
    const columns: ColumnsType<CollectionItem> = tableColumns.map(col => {
      const label = getLabel(col);
      const tooltip = getTooltip(col);
      const isSortable = sortColumns.includes(col);
      const currentSortOrder: SortOrder | null | undefined =
        sortColumn === col
          ? sort === SortOrderEnum.Asc
            ? 'ascend'
            : sort === SortOrderEnum.Desc
              ? 'descend'
              : null
          : null;

      return {
        key: col,
        dataIndex: col,
        minWidth: 100,
        title: (
          <>
            {label}
            {tooltip && (
              <>
                {' '}
                <InfoTooltip
                  label={t('description')}
                  tooltip={tooltip}
                  placement="top"
                />
              </>
            )}
          </>
        ),
        render: (_text: unknown, record: CollectionItem) =>
          renderCell(record, col),
        onCell: (record: CollectionItem) => {
          const cellPropsFn = itemCellProps?.[col];
          const val = record[col];
          return cellPropsFn ? cellPropsFn(val, label, record) : {};
        },
        sorter: isSortable,
        sortOrder: currentSortOrder,
      };
    });

    if (allowDeletes) {
      columns.push({
        key: '__actions',
        dataIndex: '__actions',
        sorter: false,
        title: <></>,
        onCell: () => ({}),
        sortOrder: null,
        minWidth: 50,
        render: (_, record: CollectionItem) => (
          <span
            data-test="crud-delete-option"
            className="text-primary"
            css={(theme: SupersetTheme) => css`
              display: flex;
              justify-content: center;
              color: ${theme.colorTextTertiary};
            `}
          >
            {/* role is auto-computed by BaseIconComponent as "button" since
                onClick is present, so no explicit role needed here. */}
            <Icons.DeleteOutlined
              aria-label={t('Delete item')}
              className="pointer"
              data-test="crud-delete-icon"
              tabIndex={0}
              onClick={() => deleteItem(record.id)}
              iconSize="l"
              iconColor="inherit"
            />
          </span>
        ),
      });
    }

    return columns;
  }, [
    tableColumns,
    getLabel,
    getTooltip,
    sortColumns,
    sortColumn,
    sort,
    renderCell,
    itemCellProps,
    allowDeletes,
    deleteItem,
  ]);

  const displayData = useMemo(() => {
    if (filterTerm && filterFields?.length) {
      return collectionArray.filter(item =>
        filterFields.some(field =>
          String(item[field] ?? '')
            .toLowerCase()
            .includes(filterTerm.toLowerCase()),
        ),
      );
    }
    return collectionArray;
  }, [collectionArray, filterTerm, filterFields]);

  const paginationConfig = useMemo((): false | TablePaginationConfig => {
    if (pagination === false || pagination === undefined) {
      return false;
    }
    // Clamp currentPage to the valid range based on the filtered data
    // length — without this, filtering down to fewer rows could leave the
    // user on an empty page until they click somewhere.
    const totalItems = displayData.length;
    const maxPage = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1;
    const clampedPage = Math.min(currentPage, maxPage);
    return {
      ...(typeof pagination === 'object' ? pagination : {}),
      current: clampedPage,
      pageSize,
      total: totalItems,
    };
  }, [pagination, displayData.length, pageSize, currentPage]);

  const expandedRowKeys = useMemo(
    () => Object.keys(expandedColumns).filter(id => expandedColumns[id]),
    [expandedColumns],
  );

  const expandableConfig = useMemo(
    () =>
      expandFieldset
        ? {
            expandedRowRender: (record: CollectionItem) =>
              renderExpandableSection(record),
            rowExpandable: () => true,
            expandedRowKeys,
            onExpand: (_expanded: boolean, record: CollectionItem) => {
              toggleExpand(record.id);
            },
          }
        : undefined,
    [expandFieldset, renderExpandableSection, expandedRowKeys, toggleExpand],
  );

  return (
    <>
      <CrudButtonWrapper>
        {allowAddItem && (
          <StyledButtonWrapper>
            <Button
              buttonSize="small"
              buttonStyle="secondary"
              onClick={onAddItem}
              data-test="add-item-button"
            >
              <Icons.PlusOutlined
                iconSize="m"
                data-test="crud-add-table-item"
              />
              {t('Add item')}
            </Button>
          </StyledButtonWrapper>
        )}
      </CrudButtonWrapper>
      <Table<CollectionItem>
        data-test="crud-table"
        columns={antdColumns}
        data={displayData}
        rowKey={(record: CollectionItem) => String(record.id)}
        sticky={stickyHeader}
        pagination={paginationConfig}
        onChange={handleTableChange}
        locale={{ emptyText: emptyMessage }}
        css={
          stickyHeader &&
          css`
            height: 350px;
            overflow: auto;
          `
        }
        expandable={expandableConfig}
        size={TableSize.Middle}
        tableLayout="auto"
      />
    </>
  );
}
