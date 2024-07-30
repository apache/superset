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
import { FC, useCallback, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { ClientErrorObject, getExtensionsRegistry, t } from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import { Skeleton } from 'src/components';
import FilterableTable from 'src/components/FilterableTable';
import Tabs from 'src/components/Tabs';
import {
  useTableExtendedMetadataQuery,
  useTableMetadataQuery,
} from 'src/hooks/apiResources';
import { runTablePreviewQuery } from 'src/SqlLab/actions/sqlLab';
import Alert from 'src/components/Alert';
import { renderWell } from '../TableElement';
import ResultSet from '../ResultSet';
import type { TokenMetadata } from './AceEditorTokenProvider';

const extensionsRegistry = getExtensionsRegistry();

const COLUMN_KEYS = ['column_name', 'column_type'];

const CONTENT_HEIGHT = 300;
const PREVIEW_QUERY_LIMIT = 100;

const TableMetadataContent: FC<TokenMetadata> = ({
  dbId,
  catalog,
  schema,
  value,
}) => {
  const [previewQueryId, setPreviewQueryId] = useState<string>();
  const {
    currentData: tableMetadata,
    isLoading: isMetadataLoading,
    isError: hasMetadataError,
    error: metadataError,
  } = useTableMetadataQuery(
    {
      dbId,
      catalog,
      schema: schema ?? '',
      table: value ?? '',
    },
    { skip: !dbId || !schema || !value },
  );
  const { currentData: tableExtendedMetadata, error: metadataExtrError } =
    useTableExtendedMetadataQuery(
      {
        dbId,
        catalog,
        schema: schema ?? '',
        table: value ?? '',
      },
      { skip: !dbId || !schema || !value },
    );
  const data = useMemo(
    () =>
      (tableMetadata?.columns.length ?? 0) > 0
        ? tableMetadata?.columns.map(({ name, type, keys, comment }) => ({
            column_name: name,
            column_type: type,
            keys,
            comment,
          }))
        : undefined,
    [tableMetadata],
  );
  const hasKeys = useMemo(
    () => data?.some(({ keys }) => Boolean(keys?.length)),
    [data],
  );
  const tableData = {
    ...tableMetadata,
    ...tableExtendedMetadata,
  };
  const ResultTable =
    extensionsRegistry.get('sqleditor.extension.resultTable') ??
    FilterableTable;
  const dispatch = useDispatch();
  const onTabSwitch = useCallback(
    (activeKey: string) => {
      if (activeKey === 'preview' && !previewQueryId) {
        const queryId = nanoid(11);
        dispatch(
          runTablePreviewQuery(
            {
              previewQueryId: queryId,
              dbId,
              catalog,
              schema,
              name: value,
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
      value,
      tableData.selectStar,
      dispatch,
    ],
  );

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
        message={t('Cannot find the table (%s) metadata.', value)}
        closable={false}
      />
    );
  }
  return (
    <>
      {tableData.comment}
      {tableMetadata && renderWell(tableMetadata)}
      <Tabs onTabClick={onTabSwitch}>
        <Tabs.TabPane tab={t('Columns (%s)', data.length)} key="columns">
          <ResultTable
            queryId="table-metadata-preview"
            height={CONTENT_HEIGHT}
            data={data}
            orderedColumnKeys={
              hasKeys ? COLUMN_KEYS.concat('keys') : COLUMN_KEYS
            }
          />
        </Tabs.TabPane>
        {tableData?.selectStar && (
          <Tabs.TabPane tab={t('Preview')} key="preview">
            {previewQueryId && (
              <ResultSet
                queryId={previewQueryId}
                visualize={false}
                csv={false}
                cache
                height={CONTENT_HEIGHT}
                displayLimit={PREVIEW_QUERY_LIMIT}
                defaultQueryLimit={PREVIEW_QUERY_LIMIT}
              />
            )}
          </Tabs.TabPane>
        )}
      </Tabs>
    </>
  );
};

export default TableMetadataContent;
