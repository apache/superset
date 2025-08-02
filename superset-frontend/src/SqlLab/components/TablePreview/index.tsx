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
import { type FC, useCallback, useMemo, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { nanoid } from 'nanoid';
import {
  ClientErrorObject,
  css,
  getExtensionsRegistry,
  styled,
  t,
} from '@superset-ui/core';
import {
  SafeMarkdown,
  Alert,
  Breadcrumb,
  Button,
  Card,
  Dropdown,
  Skeleton,
} from '@superset-ui/core/components';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Icons } from '@superset-ui/core/components/Icons';
import type { SqlLabRootState } from 'src/SqlLab/types';
import { CopyToClipboard, FilterableTable } from 'src/components';
import Tabs from '@superset-ui/core/components/Tabs';
import {
  tableApiUtil,
  TableMetaData,
  useTableExtendedMetadataQuery,
  useTableMetadataQuery,
} from 'src/hooks/apiResources';
import { runTablePreviewQuery } from 'src/SqlLab/actions/sqlLab';
import { Menu } from '@superset-ui/core/components/Menu';
import ResultSet from '../ResultSet';
import ShowSQL from '../ShowSQL';

type Props = {
  dbId: number | string;
  schema?: string;
  catalog?: string | null;
  tableName: string;
};

const extensionsRegistry = getExtensionsRegistry();

const COLUMN_KEYS = ['column_name', 'column_type', 'keys', 'comment'];

const TABS_KEYS = {
  COLUMNS: 'columns',
  METADATA: 'metadata',
  INDEXES: 'indexes',
  SAMPLE: 'sample',
};
const MENUS = [
  {
    key: 'refresh-table',
    label: t('Refresh table schema'),
    icon: <Icons.SyncOutlined iconSize="s" aria-hidden />,
  },
  {
    key: 'copy-select-statement',
    label: t('Copy SELECT statement'),
    icon: <Icons.CopyOutlined iconSize="s" aria-hidden />,
  },
  {
    key: 'show-create-view-statement',
    label: t('Show CREATE VIEW statement'),
    icon: <Icons.EyeOutlined iconSize="s" aria-hidden />,
  },
];
const TAB_HEADER_HEIGHT = 80;
const PREVIEW_TOP_ACTION_HEIGHT = 30;
const PREVIEW_QUERY_LIMIT = 100;

const Title = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: row;
    align-items: center;
    column-gap: ${theme.sizeUnit}px;
    font-size: ${theme.fontSizeLG}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;
const renderWell = (partitions: TableMetaData['partitions']) => {
  if (!partitions) {
    return null;
  }
  const { partitionQuery } = partitions;
  let partitionClipBoard;
  if (partitionQuery) {
    const tt = t('Copy partition query to clipboard');
    partitionClipBoard = (
      <CopyToClipboard
        text={partitionQuery}
        shouldShowText={false}
        tooltipText={tt}
        copyNode={<Icons.CopyOutlined iconSize="s" />}
      />
    );
  }
  const latest = Object.entries(partitions.latest || [])
    .map(([key, value]) => `${key}=${value}`)
    .join('/');

  return (
    <Card size="small">
      <div>
        <small>
          {t('latest partition:')} {latest}
        </small>{' '}
        {partitionClipBoard}
      </div>
    </Card>
  );
};

const TablePreview: FC<Props> = ({ dbId, catalog, schema, tableName }) => {
  const dispatch = useDispatch();
  const [databaseName, backend, disableDataPreview] = useSelector<
    SqlLabRootState,
    string[]
  >(
    ({ sqlLab: { databases } }) => [
      databases[dbId]?.database_name,
      databases[dbId]?.backend,
      databases[dbId]?.disable_data_preview,
    ],
    shallowEqual,
  );
  const copyStatementActionRef = useRef<HTMLButtonElement | null>(null);
  const showViewStatementActionRef = useRef<HTMLButtonElement | null>(null);
  const [previewQueryId, setPreviewQueryId] = useState<string>();
  const {
    currentData: tableMetadata,
    isLoading: isMetadataLoading,
    isFetching: isMetadataRefreshing,
    isError: hasMetadataError,
    error: metadataError,
  } = useTableMetadataQuery(
    {
      dbId,
      catalog,
      schema: schema ?? '',
      table: tableName ?? '',
    },
    { skip: !dbId || !schema || !tableName },
  );
  const { currentData: tableExtendedMetadata, error: metadataExtrError } =
    useTableExtendedMetadataQuery(
      {
        dbId,
        catalog,
        schema: schema ?? '',
        table: tableName ?? '',
      },
      { skip: !dbId || !schema || !tableName },
    );
  const data = useMemo(
    () =>
      (tableMetadata?.columns.length ?? 0) > 0
        ? tableMetadata?.columns.map(
            ({ name, type, longType, keys, comment }) => ({
              column_name: name,
              column_type: longType || type,
              keys,
              comment,
            }),
          )
        : undefined,
    [tableMetadata],
  );
  const hasKeys = useMemo(
    () => data?.some(({ keys }) => Boolean(keys?.length)),
    [data],
  );
  const columns = useMemo(
    () => (hasKeys ? COLUMN_KEYS : COLUMN_KEYS.filter(name => name !== 'keys')),
    [hasKeys],
  );
  const tableData = {
    dataPreviewQueryId: previewQueryId,
    ...tableMetadata,
    ...tableExtendedMetadata,
  };
  const refreshTableMetadata = () => {
    dispatch(
      tableApiUtil.invalidateTags([{ type: 'TableMetadatas', id: tableName }]),
    );
  };
  const ResultTable =
    extensionsRegistry.get('sqleditor.extension.resultTable') ??
    FilterableTable;
  const customTabs =
    extensionsRegistry.get('sqleditor.extension.tablePreview') ?? [];
  const onTabSwitch = useCallback(
    (activeKey: string) => {
      if (activeKey === 'sample' && !previewQueryId) {
        const queryId = nanoid(11);
        dispatch(
          runTablePreviewQuery(
            {
              previewQueryId: queryId,
              dbId,
              catalog,
              schema,
              name: tableName,
              selectStar: tableData.selectStar,
            },
            true,
          ),
        );
        setPreviewQueryId(queryId);
      }
    },
    [
      previewQueryId,
      dbId,
      catalog,
      schema,
      tableName,
      tableData.selectStar,
      dispatch,
    ],
  );

  const dropdownMenu = useMemo(() => {
    let menus = [...MENUS];
    if (!tableData.selectStar) {
      menus = menus.filter(({ key }) => key !== 'copy-select-statement');
    }
    if (!tableData.view) {
      menus = menus.filter(({ key }) => key !== 'show-create-view-statement');
    }
    return menus;
  }, [tableData.view, tableData.selectStar]);

  if (isMetadataLoading) {
    return <Skeleton active />;
  }

  if (hasMetadataError || metadataExtrError) {
    return (
      <Alert
        type="warning"
        message={
          ((metadataError || metadataExtrError) as ClientErrorObject)?.error
        }
      />
    );
  }
  if (!data) {
    return (
      <Alert
        type="warning"
        message={t('Cannot find the table (%s) metadata.', tableName)}
        closable={false}
      />
    );
  }
  return (
    <div
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
      `}
    >
      <Breadcrumb separator=">">
        <Breadcrumb.Item>{backend}</Breadcrumb.Item>
        <Breadcrumb.Item>{databaseName}</Breadcrumb.Item>
        {catalog && <Breadcrumb.Item>{catalog}</Breadcrumb.Item>}
        {schema && <Breadcrumb.Item>{schema}</Breadcrumb.Item>}
        <Breadcrumb.Item> </Breadcrumb.Item>
      </Breadcrumb>
      <div style={{ display: 'none' }}>
        <CopyToClipboard
          copyNode={
            <button type="button" ref={copyStatementActionRef}>
              invisible button
            </button>
          }
          text={tableData.selectStar}
          shouldShowText={false}
        />
        {tableData.view && (
          <ShowSQL
            sql={tableData.view}
            tooltipText={t('Show CREATE VIEW statement')}
            title={t('CREATE VIEW statement')}
            triggerNode={
              <button type="button" ref={showViewStatementActionRef}>
                invisible button
              </button>
            }
          />
        )}
      </div>
      <Title>
        <Icons.InsertRowAboveOutlined iconSize="l" />
        {tableName}
        <Dropdown
          popupRender={() => (
            <Menu
              onClick={({ key }) => {
                if (key === 'refresh-table') {
                  refreshTableMetadata();
                }
                if (key === 'copy-select-statement') {
                  copyStatementActionRef.current?.click();
                }
                if (key === 'show-create-view-statement') {
                  showViewStatementActionRef.current?.click();
                }
              }}
              items={dropdownMenu}
            />
          )}
          trigger={['click']}
        >
          <Button buttonSize="xsmall" buttonStyle="link">
            <Icons.DownSquareOutlined
              iconSize="m"
              style={{ marginTop: 2, marginLeft: 4 }}
              aria-label={t('Table actions')}
            />
          </Button>
        </Dropdown>
      </Title>
      {isMetadataRefreshing ? (
        <Skeleton active />
      ) : (
        <>
          {tableData.comment && <SafeMarkdown source={tableData.comment} />}
          {renderWell(tableData.partitions)}
          <div
            css={css`
              flex: 1 1 auto;
            `}
          >
            <AutoSizer disableWidth>
              {({ height }) => {
                const tabItems = [];

                tabItems.push({
                  key: TABS_KEYS.COLUMNS,
                  label: t('Columns (%s)', data.length),
                  children: (
                    <ResultTable
                      queryId="table-columns"
                      height={height - TAB_HEADER_HEIGHT}
                      data={data}
                      orderedColumnKeys={columns}
                    />
                  ),
                });

                if (tableData?.selectStar && !disableDataPreview) {
                  tabItems.push({
                    key: TABS_KEYS.SAMPLE,
                    label: t('Data preview'),
                    children: previewQueryId && (
                      <ResultSet
                        queryId={previewQueryId}
                        visualize={false}
                        csv={false}
                        cache
                        height={
                          height - TAB_HEADER_HEIGHT - PREVIEW_TOP_ACTION_HEIGHT
                        }
                        displayLimit={PREVIEW_QUERY_LIMIT}
                        defaultQueryLimit={PREVIEW_QUERY_LIMIT}
                      />
                    ),
                  });
                }

                if (tableData?.indexes && tableData.indexes.length > 0) {
                  tabItems.push({
                    key: TABS_KEYS.INDEXES,
                    label: t('Indexes (%s)', tableData.indexes.length),
                    children: tableData.indexes.map((ix, i) => (
                      <pre className="code" key={i}>
                        {JSON.stringify(ix, null, '  ')}
                      </pre>
                    )),
                  });
                }

                if (tableData?.metadata) {
                  tabItems.push({
                    key: TABS_KEYS.METADATA,
                    label: t('Metadata'),
                    children: (
                      <ResultTable
                        queryId="table-metadata"
                        height={height - TAB_HEADER_HEIGHT}
                        data={Object.entries(tableData.metadata).map(
                          ([name, value]) => ({
                            name,
                            value,
                          }),
                        )}
                        orderedColumnKeys={['name', 'value']}
                      />
                    ),
                  });
                }

                customTabs.forEach(([title, ExtComponent]) => {
                  tabItems.push({
                    key: title,
                    label: title,
                    children: (
                      <ExtComponent
                        dbId={Number(dbId)}
                        schema={schema ?? ''}
                        tableName={tableName}
                      />
                    ),
                  });
                });

                return (
                  <Tabs
                    onTabClick={onTabSwitch}
                    css={css`
                      height: ${height}px;
                    `}
                    items={tabItems}
                  />
                );
              }}
            </AutoSizer>
          </div>
        </>
      )}
    </div>
  );
};

export default TablePreview;
