import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  type ChangeEvent,
} from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { css, styled, useTheme, t } from '@superset-ui/core';
import AutoSizer from 'react-virtualized-auto-sizer';
import Icons from 'src/components/Icons';
import { Skeleton, Tree, type AntdDataNode } from 'src/components';
import type { SqlLabRootState } from 'src/SqlLab/types';
import ColumnElement from 'src/SqlLab/components/ColumnElement';
import {
  Table,
  TableMetaData,
  useSchemas,
  useLazyTablesQuery,
  useLazyTableMetadataQuery,
  useLazyTableExtendedMetadataQuery,
} from 'src/hooks/apiResources';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { Tooltip } from 'src/components/Tooltip';
import RefreshLabel from 'src/components/RefreshLabel';
import { addTable } from 'src/SqlLab/actions/sqlLab';
import { Input } from 'src/components/Input';
import IconButton from 'src/dashboard/components/IconButton';

type Props = {
  queryEditorId: string;
};

const SideActionContainer = styled.div`
  opacity: 0;
  position: absolute;
  right: ${({ theme }) => theme.gridUnit * 1.5}px;
  top: 0;
  z-index: ${({ theme }) => theme.zIndex.dropdown};
`;

const StyledTree = styled(Tree)`
  .ant-tree-node-content-wrapper {
    &:hover [role='menu'] {
      opacity: 1;
    }

    &.ant-tree-node-selected {
      background-color: ${({ theme }) => theme.colors.grayscale.light4};
      & [role='menu'] {
        opacity: 1;
      }
    }
  }
`;

function appendAt<T>(array: T[], index: number, value: T) {
  return index < 0
    ? [...array, value]
    : [...array.slice(0, index), value, ...array.slice(index)];
}

function isDisabledNode(node: AntdDataNode | undefined) {
  return node?.disableCheckbox || node?.selectable;
}

function firstDisabledNode(nodes: AntdDataNode[]) {
  let left = 0;
  let right = nodes.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (isDisabledNode(nodes[mid])) {
      right = mid;
    } else {
      left = mid + 1;
    }
  }

  return isDisabledNode(nodes[left]) ? left : -1;
}

export const filterTreeNode = (
  nodes: AntdDataNode[] | undefined,
  keyword: string,
  depth = 0,
): AntdDataNode[] =>
  nodes?.reduce(
    (acc, { key, children, ...otherProps }) => {
      if (children) {
        const filteredChildren = filterTreeNode(children, keyword, depth + 1);
        if (filteredChildren.length > 0) {
          const item = {
            ...otherProps,
            key,
            children: filteredChildren,
          };
          return appendAt(acc, firstDisabledNode(acc), item);
        }
      }
      if (`${key}`.includes(keyword)) {
        const item = { ...otherProps, key, children };
        return appendAt(acc, firstDisabledNode(acc), item);
      }
      return acc;
    },
    nodes.slice(0, 0),
  ) ?? [];

const getOpacity = (
  disableCheckbox: boolean | undefined,
  selectable: boolean | undefined,
) => ({
  opacity: disableCheckbox ? 0.6 : 1,
  ...(selectable && { textDecoration: 'line-through' }),
});

const TableExploreTree: React.FC<Props> = ({ queryEditorId }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const tables = useSelector(
    ({ sqlLab }: SqlLabRootState) => sqlLab.tables,
    shallowEqual,
  );
  const queryEditor = useQueryEditor(queryEditorId, [
    'dbId',
    'schema',
    'catalog',
  ]);
  const { dbId, catalog } = queryEditor;
  const pinnedTables = useMemo(
    () =>
      Object.fromEntries(
        tables.map(({ queryEditorId, dbId, schema, name, persistData }) => [
          queryEditor.id === queryEditorId ? `${dbId}:${schema}:${name}` : '',
          persistData,
        ]),
      ),
    [tables, queryEditor.id],
  );
  const {
    currentData: schemaData,
    isFetching,
    refetch,
  } = useSchemas({ dbId, catalog });
  const [tableData, setTableData] =
    useState<Record<string, { options: Table[] }>>();
  const [tableSchemaData, setTableSchemaData] = useState<
    Record<string, TableMetaData>
  >({});
  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    `schema:${dbId}:${queryEditor.schema}`,
  ]);
  const [fetchLazyTables] = useLazyTablesQuery();
  const [fetchTableMetadata] = useLazyTableMetadataQuery();
  const [fetchTableExtendedMetadata] = useLazyTableExtendedMetadataQuery();

  const handlePinTable = useCallback(
    (tableName, schemaName, catalogName) =>
      dispatch(addTable(queryEditor, tableName, catalogName, schemaName)),
    [dispatch, queryEditor],
  );
  const [searchText, setSearchText] = useState('');
  const handleSearchChange = useCallback(
    ({ target }: ChangeEvent<HTMLInputElement>) => setSearchText(target.value),
    [],
  );

  const treeData = useMemo(() => {
    const data = schemaData?.map(schema => ({
      title: schema.label,
      key: `schema:${dbId}:${schema.value}`,
      checkable: false,
      selectable: false,
      disableCheckbox: false,
      icon: ({ expanded }: { expanded: Boolean }) =>
        expanded ? (
          <Icons.FolderOpenOutlined iconSize="l" />
        ) : (
          <Icons.FolderOutlined iconSize="l" />
        ),

      children: tableData?.[`${dbId}:${schema.value}`]?.options?.map(
        ({ value: tableName, type: tableType }) => {
          const tableKey = `${dbId}:${schema.value}:${tableName}`;
          const disableCheckbox =
            !tableSchemaData[tableKey] && !pinnedTables[tableKey];
          const columns =
            tableSchemaData[tableKey]?.columns ??
            pinnedTables[tableKey]?.columns;
          const index = tableName.indexOf(searchText);
          const beforeStr = tableName.substring(0, index);
          const afterStr = tableName.slice(index + searchText.length);
          return {
            title:
              index > -1 ? (
                <span>
                  {beforeStr}
                  <span className="highlighted">{searchText}</span>
                  {afterStr}
                </span>
              ) : (
                tableName
              ),
            key: `table:${dbId}:${schema.value}:${tableName}`,
            checkable: false,
            selectable: false,
            disableCheckbox,
            icon:
              tableType === 'view' ? (
                <Icons.Eye
                  iconSize="l"
                  style={getOpacity(disableCheckbox, false)}
                />
              ) : (
                <Icons.Table
                  iconSize="l"
                  style={getOpacity(disableCheckbox, false)}
                />
              ),
            children: columns?.map(col => ({
              title: <ColumnElement column={col} searchText={searchText} />,
              key: `column:${dbId}:${schema.value}:${tableName}:${col.name}`,
              checkable: false,
              selectable: false,
              isLeaf: true,
              disableCheckbox: false,
            })),
          };
        },
      ),
    }));

    if (searchText) {
      return data
        ?.map(({ title, children, ...otherProps }) => ({
          title,
          children: filterTreeNode(children, searchText),
          ...otherProps,
        }))
        .filter(({ children }) => Boolean(children?.length));
    }

    return data;
  }, [dbId, schemaData, tableData, tableSchemaData, pinnedTables, searchText]);

  useEffect(() => {
    if (searchText && treeData) {
      const updatedExpandedKeys = [];
      const seek: AntdDataNode[] = [...treeData];
      while (seek.length > 0) {
        const node = seek.shift();
        if (node?.children) {
          updatedExpandedKeys.push(`${node.key}`);
          seek.push(...node.children);
        }
      }
      setExpandedKeys(updatedExpandedKeys);
    }
  }, [searchText]);

  const onLoadData = useCallback(
    ({ key, children }) =>
      new Promise<void>((resolve, reject) => {
        const [identifier, databaseId, schema, table] = key.split(':');
        const dbId = Number(databaseId);
        if (children) {
          resolve();
          return;
        }
        if (identifier === 'schema') {
          fetchLazyTables(
            {
              dbId,
              catalog,
              schema,
              forceRefresh: false,
            },
            true,
          )
            .then(({ data }) => {
              if (data) {
                setTableData(origin => ({
                  ...origin,
                  [`${dbId}:${schema}`]: data,
                }));
                resolve();
              }
            })
            .catch(() => {
              reject();
            });
        }
        if (identifier === 'table') {
          Promise.all([
            fetchTableMetadata(
              {
                dbId,
                catalog,
                schema,
                table,
              },
              true,
            ),
            fetchTableExtendedMetadata(
              {
                dbId,
                catalog,
                schema,
                table,
              },
              true,
            ),
          ]).then(
            ([{ data: tableMetadata }, { data: tableExtendedMetadata }]) => {
              if (tableMetadata) {
                setTableSchemaData(origin => ({
                  ...origin,
                  [`${dbId}:${schema}:${table}`]: {
                    ...tableMetadata,
                    ...tableExtendedMetadata,
                  },
                }));
                resolve();
              }
            },
          );
        }
      }),
    [catalog, fetchLazyTables, fetchTableExtendedMetadata, fetchTableMetadata],
  );

  return (
    <>
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          column-gap: ${theme.gridUnit}px;
          padding-bottom: ${theme.gridUnit * 2}px;
        `}
      >
        <Input
          type="text"
          className="form-control input-sm"
          placeholder="Enter a part of the object name"
          onChange={handleSearchChange}
          value={searchText}
        />
        <div
          css={css`
            margin-right: 6px;
          `}
        >
          <RefreshLabel
            onClick={() => refetch()}
            tooltipContent={t('Force refresh schema list')}
          />
        </div>
      </div>
      <div
        css={css`
          flex: 1 1 auto;
        `}
      >
        <AutoSizer disableWidth>
          {({ height }) =>
            isFetching ? (
              <Skeleton active />
            ) : (
              <StyledTree
                showLine={{
                  showLeafIcon: false,
                }}
                titleRender={({ key, title, disableCheckbox, selectable }) => {
                  const [identifier, dbId, schema, value] = `${key}`.split(':');

                  return (
                    <>
                      <span style={getOpacity(disableCheckbox, selectable)}>
                        {title}
                      </span>
                      {identifier === 'schema' && (
                        <SideActionContainer role="menu">
                          <RefreshLabel
                            onClick={() =>
                              fetchLazyTables({
                                dbId,
                                catalog,
                                schema,
                                forceRefresh: true,
                              })
                            }
                            tooltipContent={t('Force refresh table list')}
                          />
                        </SideActionContainer>
                      )}
                      {identifier === 'table' && (
                        <SideActionContainer role="menu">
                          <IconButton
                            icon={
                              <Tooltip title="Pin to the result panel">
                                <Icons.FolderAddOutlined iconSize="xl" />
                              </Tooltip>
                            }
                            onClick={e => {
                              e.stopPropagation();
                              handlePinTable(value, schema, catalog);
                            }}
                          />
                        </SideActionContainer>
                      )}
                    </>
                  );
                }}
                blockNode
                showIcon
                autoExpandParent
                treeData={treeData}
                loadData={onLoadData}
                height={height}
                onExpand={(keys: string[]) => setExpandedKeys(keys)}
                expandedKeys={expandedKeys}
              />
            )
          }
        </AutoSizer>
      </div>
    </>
  );
};

export default TableExploreTree;
