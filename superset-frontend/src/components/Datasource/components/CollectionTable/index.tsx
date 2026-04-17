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
import { ReactNode, useState, useCallback, useEffect, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core';
import { styled, css, SupersetTheme } from '@apache-superset/core/ui';
import { Icons, Button, InfoTooltip } from '@superset-ui/core/components';
import { FilterValue } from 'react-table';
import Table, {
  type ColumnsType,
  type SortOrder,
  type SorterResult,
  type TablePaginationConfig,
  TableSize,
} from '@superset-ui/core/components/Table';
import Fieldset from '../Fieldset';
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
        id: o.id || nanoid(),
      }) as CollectionItem,
  );

  const collection: Record<PropertyKey, CollectionItem> = {};
  collectionArray.forEach((o: CollectionItem) => {
    collection[o.id] = o;
  });

  return {
    collection,
    collectionArray,
  };
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
  const [collection, setCollection] = useState<
    Record<PropertyKey, CollectionItem>
  >(() => createKeyedCollection(propsCollection).collection);
  const [collectionArray, setCollectionArray] = useState<CollectionItem[]>(
    () => createKeyedCollection(propsCollection).collectionArray,
  );
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sort, setSort] = useState<SortOrderEnum>(SortOrderEnum.Unsorted);

  // Sync with props.collection changes
  useEffect(() => {
    const { collection: newCollection, collectionArray: newCollectionArray } =
      createKeyedCollection(propsCollection);
    setCollection(newCollection);
    setCollectionArray(newCollectionArray);
  }, [propsCollection]);

  const onCellChange = useCallback(
    (id: string | number, col: string, val: unknown) => {
      setCollection(prevCollection => {
        const updatedCollection = {
          ...prevCollection,
          [id]: {
            ...prevCollection[id],
            [col]: val,
          },
        };
        return updatedCollection;
      });

      setCollectionArray(prevCollectionArray => {
        const updatedCollectionArray = prevCollectionArray.map(item => {
          if (item.id === id) {
            return {
              ...item,
              [col]: val,
            };
          }
          return item;
        });

        if (onChange) {
          onChange(updatedCollectionArray);
        }

        return updatedCollectionArray;
      });
    },
    [onChange],
  );

  const changeCollection = useCallback(
    (
      newCollection: Record<PropertyKey, CollectionItem>,
      currentCollectionArray: CollectionItem[],
    ) => {
      // Preserve existing order instead of recreating from Object.keys()
      const existingIds = new Set(currentCollectionArray.map(item => item.id));
      const newCollectionArray: CollectionItem[] = [];

      // First pass: preserve existing order and update items
      for (const existingItem of currentCollectionArray) {
        if (newCollection[existingItem.id]) {
          newCollectionArray.push(newCollection[existingItem.id]);
        }
      }

      // Second pass: add new items
      for (const item of Object.values(newCollection)) {
        if (!existingIds.has(item.id)) {
          newCollectionArray.push(item);
        }
      }

      setCollection(newCollection);
      setCollectionArray(newCollectionArray);

      if (onChange) {
        onChange(newCollectionArray);
      }
    },
    [onChange],
  );

  const deleteItem = useCallback(
    (id: string | number) => {
      setCollection(prevCollection => {
        const newColl = { ...prevCollection };
        delete newColl[id];
        return newColl;
      });

      setCollectionArray(prevCollectionArray => {
        const newCollectionArray = prevCollectionArray.filter(
          item => item.id !== id,
        );

        if (onChange) {
          onChange(newCollectionArray);
        }

        return newCollectionArray;
      });
    },
    [onChange],
  );

  const onAddItem = useCallback(() => {
    if (itemGenerator) {
      let newItem = itemGenerator() as CollectionItem;
      const shouldStartExpanded = newItem.expanded === true;
      if (!newItem.id) {
        newItem = { ...newItem, id: nanoid() };
      }
      delete newItem.expanded;

      setCollection(prevCollection => ({
        ...prevCollection,
        [newItem.id]: newItem,
      }));

      setCollectionArray(prevCollectionArray => {
        const newCollectionArray = [newItem, ...prevCollectionArray];

        if (onChange) {
          onChange(newCollectionArray);
        }

        return newCollectionArray;
      });

      if (shouldStartExpanded) {
        setExpandedColumns(prev => ({ ...prev, [newItem.id]: true }));
      }
    }
  }, [itemGenerator, onChange]);

  const onFieldsetChange = useCallback(
    (item: CollectionItem) => {
      changeCollection(
        {
          ...collection,
          [item.id]: item,
        },
        collectionArray,
      );
    },
    [changeCollection, collection, collectionArray],
  );

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
      _pagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<CollectionItem> | SorterResult<CollectionItem>[],
    ) => {
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

      if (
        sortColumns?.includes(col) ||
        newSortOrder === SortOrderEnum.Unsorted
      ) {
        let sortedArray = [...propsCollection] as CollectionItem[];

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

          sortedArray.sort((a: CollectionItem, b: CollectionItem) =>
            compareSort(a[col] as Sort, b[col] as Sort),
          );
          if (newSortOrder === SortOrderEnum.Desc) {
            sortedArray.reverse();
          }
        } else {
          const { collectionArray: resetArray } =
            createKeyedCollection(propsCollection);
          sortedArray = resetArray;
        }

        setCollectionArray(sortedArray);
        setSortColumn(newSortColumn);
        setSort(newSortOrder);
      }
    },
    [propsCollection, sortColumns],
  );

  const renderExpandableSection = useCallback(
    (item: CollectionItem): ReactNode => {
      const propsGenerator = () => ({ item, onChange: onFieldsetChange });
      return recurseReactClone(expandFieldset, Fieldset, propsGenerator);
    },
    [expandFieldset, onFieldsetChange],
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
            <Icons.DeleteOutlined
              aria-label={t('Delete item')}
              className="pointer"
              data-test="crud-delete-icon"
              role="button"
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
    return typeof pagination === 'object' ? pagination : {};
  }, [pagination]);

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
