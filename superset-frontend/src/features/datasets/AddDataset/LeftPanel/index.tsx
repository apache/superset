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
import { useEffect, useCallback, type Dispatch } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { Flex, EmptyState } from '@superset-ui/core/components';
import { DatabaseSelector } from 'src/components/DatabaseSelector';
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
}

export default function LeftPanel({
  setDataset,
  dataset,
  onPreviewTable,
}: LeftPanelProps) {
  const theme = useTheme();
  const { addDangerToast } = useToasts();
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

  return (
    <Flex
      vertical
      gap="small"
      style={{ height: '100%', padding: theme.sizeUnit * 4 }}
    >
      <DatabaseSelector
        showSchema={false}
        db={dataset?.db}
        handleError={addDangerToast}
        onDbChange={setDatabase}
        catalog={dataset?.catalog}
        onCatalogChange={catalog =>
          setDataset({
            type: DatasetActionType.SelectCatalog,
            payload: { name: 'catalog', value: catalog },
          })
        }
      />
      {dataset?.db ? (
        <TableBrowser
          key={`${dataset.db.id}:${dataset.catalog ?? ''}`}
          dbId={dataset.db.id}
          supportsSchemas={dataset.db.supports_schemas}
          catalog={dataset.catalog}
          onPreviewTable={onPreviewTable}
        />
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
