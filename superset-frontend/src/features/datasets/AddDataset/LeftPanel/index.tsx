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
import { useEffect, useState, useCallback, type Dispatch } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import {
  Flex,
  EmptyState,
  Divider,
  Checkbox,
  Typography,
} from '@superset-ui/core/components';
import { DatabaseSelectorPopover } from 'src/components/DatabaseSelector';
import type { DatabaseObject } from 'src/components';
import { TableBrowser } from 'src/SqlLab/components/TableExploreTree';
import type { TableReference } from 'src/SqlLab/components/TableExploreTree/types';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { LocalStorageKeys, getItem } from 'src/utils/localStorageHelpers';
import {
  DatasetActionType,
  DatasetObject,
  DSReducerActionType,
} from '../types';

interface LeftPanelProps {
  setDataset: Dispatch<DSReducerActionType>;
  dataset?: Partial<DatasetObject> | null;
  onPreviewTable: (table: TableReference) => void;
  onDatasetCreated: () => void;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
}

export default function LeftPanel({
  setDataset,
  dataset,
  onPreviewTable,
  onDatasetCreated,
  disabled = false,
  onBusyChange,
}: LeftPanelProps) {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const [multiSelect, setMultiSelect] = useState(false);
  const [creatingDataset, setCreatingDataset] = useState(false);
  const setDatabase = useCallback(
    (db: DatabaseObject) => {
      setDataset({ type: DatasetActionType.SelectDatabase, payload: { db } });
    },
    [setDataset],
  );

  useEffect(() => {
    const previous = getItem(
      LocalStorageKeys.Database,
      null,
    ) as DatabaseObject | null;
    if (previous) setDatabase(previous);
  }, [setDatabase]);

  const createSingleDataset = async (table: TableReference) => {
    if (!dataset?.db || creatingDataset || disabled) return;
    setCreatingDataset(true);
    onBusyChange(true);
    try {
      await SupersetClient.post({
        endpoint: '/api/v1/dataset/',
        jsonPayload: {
          database: dataset.db.id,
          catalog: dataset.catalog,
          schema: table.schema || null,
          table_name: table.table_name,
        },
      });
      addSuccessToast(t('Dataset "%s" created', table.table_name));
      onDatasetCreated();
    } catch {
      addDangerToast(
        t('Could not create dataset for "%s"', table.table_name),
      );
    } finally {
      setCreatingDataset(false);
      onBusyChange(false);
    }
  };

  return (
    <Flex
      vertical
      gap="small"
      style={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        padding: theme.sizeUnit * 4,
        position: 'relative',
      }}
    >
      <DatabaseSelectorPopover
        db={dataset?.db}
        handleError={addDangerToast}
        onDbChange={setDatabase}
        catalog={dataset?.catalog}
        schema={dataset?.schema ?? undefined}
        onSchemaChange={schema =>
          setDataset({
            type: DatasetActionType.SelectSchema,
            payload: { name: 'schema', value: schema },
          })
        }
        onCatalogChange={catalog =>
          setDataset({
            type: DatasetActionType.SelectCatalog,
            payload: { name: 'catalog', value: catalog },
          })
        }
      />
      <Divider style={{ margin: 0 }} />
      {dataset?.db ? (
        <>
          <Checkbox
            checked={multiSelect}
            disabled={disabled}
            onChange={({ target }) => {
              setMultiSelect(target.checked);
              if (!target.checked) {
                setDataset({
                  type: DatasetActionType.SelectTableReferences,
                  payload: [],
                });
              }
            }}
          >
            <Typography.Text>
              {t('Select multiple tables')}
            </Typography.Text>
          </Checkbox>
          <TableBrowser
            key={`${dataset.db.id}:${dataset.catalog ?? ''}`}
            dbId={dataset.db.id}
            supportsSchemas={dataset.db.supports_schemas}
            schema={dataset.schema ?? undefined}
            catalog={dataset.catalog}
            onPreviewTable={onPreviewTable}
            onCreateDataset={createSingleDataset}
            creatingDataset={creatingDataset || disabled}
            disabled={disabled}
            selectedTables={
              multiSelect ? (dataset.selected_tables ?? []) : undefined
            }
            onSelectionChange={
              multiSelect
                ? selectedTables =>
                    setDataset({
                      type: DatasetActionType.SelectTableReferences,
                      payload: selectedTables,
                    })
                : undefined
            }
            maxSelection={100}
            showSelectAll={Boolean(dataset.schema)}
          />
        </>
      ) : (
        <EmptyState
          image="empty.svg"
          size="small"
          title={t('Select a data connection')}
          description={t(
            'Choose a data connection to browse schemas, tables, and views.',
          )}
        />
      )}
    </Flex>
  );
}
