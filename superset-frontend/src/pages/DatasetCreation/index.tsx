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
import { useEffect, useReducer, useState } from 'react';
import { useParams } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { Flex, Table, Tag } from '@superset-ui/core/components';
import type { TableReference } from 'src/SqlLab/components/TableExploreTree/types';
import useDatasetsList from 'src/features/datasets/hooks/useDatasetLists';
import Header from 'src/features/datasets/AddDataset/Header';
import EditPage from 'src/features/datasets/AddDataset/EditDataset';
import DatasetPanel from 'src/features/datasets/AddDataset/DatasetPanel';
import LeftPanel from 'src/features/datasets/AddDataset/LeftPanel';
import Footer from 'src/features/datasets/AddDataset/Footer';
import {
  DatasetActionType,
  DatasetObject,
  DSReducerActionType,
} from 'src/features/datasets/AddDataset/types';
import DatasetLayout from 'src/features/datasets/DatasetLayout';

export function datasetReducer(
  state: Partial<DatasetObject> | null,
  action: DSReducerActionType,
): Partial<DatasetObject> | null {
  const trimmedState = {
    ...state,
  };

  switch (action.type) {
    case DatasetActionType.SelectDatabase:
      return {
        ...trimmedState,
        ...action.payload,
        catalog: null,
        schema: null,
        table_name: null,
        table_names: [],
        selected_tables: [],
      };
    case DatasetActionType.SelectCatalog:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
        schema: null,
        table_name: null,
        table_names: [],
        selected_tables: [],
      };
    case DatasetActionType.SelectSchema:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
        table_name: null,
        table_names: [],
        selected_tables: [],
      };
    case DatasetActionType.SelectTableReferences:
      return {
        ...trimmedState,
        selected_tables: action.payload,
        table_names: action.payload.map(table => table.table_name),
        table_name:
          action.payload.length === 1 ? action.payload[0].table_name : null,
        schema:
          action.payload.length === 1
            ? action.payload[0].schema
            : trimmedState.schema,
      };
    case DatasetActionType.SelectTables:
      return {
        ...trimmedState,
        table_names: action.payload,
        table_name: action.payload.length === 1 ? action.payload[0] : null,
      };
    case DatasetActionType.SelectTable:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
      };
    case DatasetActionType.ChangeDataset:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
      };
    default:
      return null;
  }
}

const prevUrl =
  '/tablemodelview/list/?pageIndex=0&sortColumn=changed_on_delta_humanized&sortOrder=desc';

export default function AddDataset() {
  const [dataset, setDataset] = useReducer(datasetReducer, null);
  const [previewTable, setPreviewTable] = useState<TableReference | null>(null);
  const [registrationVersion, setRegistrationVersion] = useState(0);
  const [creatingDatasets, setCreatingDatasets] = useState(false);
  const [hasColumns, setHasColumns] = useState(false);

  const activePreview = dataset?.table_name
    ? { schema: dataset.schema ?? '', table_name: dataset.table_name }
    : previewTable;
  const isMultiSelect = (dataset?.selected_tables?.length ?? 0) > 1;

  const { datasets } = useDatasetsList(
    dataset?.db,
    activePreview?.schema ?? dataset?.schema,
    registrationVersion,
    dataset?.catalog,
    isMultiSelect,
  );

  const { datasetId: id } = useParams<{ datasetId: string }>();
  const editPageIsVisible = !Number.isNaN(parseInt(id, 10));

  useEffect(() => {
    setPreviewTable(null);
    setHasColumns(false);
  }, [dataset?.db?.id, dataset?.catalog]);

  const HeaderComponent = () => (
    <Header setDataset={setDataset} title={dataset?.table_name} />
  );

  const LeftPanelComponent = () => (
    <LeftPanel
      setDataset={setDataset}
      dataset={dataset}
      disabled={creatingDatasets}
      onPreviewTable={setPreviewTable}
    />
  );

  const EditPageComponent = () => <EditPage id={id} />;

  const existingDatasetKeys = new Set(
    datasets
      .filter(item => item.table_name)
      .map(item => JSON.stringify([item.schema ?? '', item.table_name])),
  );

  const previewDatasets = datasets.filter(
    item =>
      dataset?.db?.supports_schemas === false ||
      (item.schema ?? '') === (activePreview?.schema ?? ''),
  );
  const previewDatasetNames = previewDatasets.map(item => item.table_name);
  const allSelectedExist =
    isMultiSelect &&
    (dataset?.selected_tables ?? []).every(table =>
      existingDatasetKeys.has(JSON.stringify([table.schema, table.table_name])),
    );

  const datasetPanelNode = (
    <DatasetPanel
      tableName={activePreview?.table_name}
      dbId={dataset?.db?.id}
      catalog={dataset?.catalog}
      schema={activePreview?.schema}
      database={dataset?.db}
      setHasColumns={setHasColumns}
      datasets={previewDatasets}
    />
  );

  const DatasetPanelComponent = () =>
    isMultiSelect ? (
      <Flex vertical gap="middle" style={{ height: '100%', minHeight: 0 }}>
        {allSelectedExist && (
          <Alert
            type="info"
            showIcon
            message={t('All selected tables already have datasets.')}
          />
        )}
        <Table
          rowKey={table => JSON.stringify([table.schema, table.table_name])}
          data={dataset?.selected_tables ?? []}
          columns={[
            { title: t('Schema'), dataIndex: 'schema' },
            { title: t('Selected table or view'), dataIndex: 'table_name' },
            {
              title: t('Status'),
              key: 'status',
              render: (_: unknown, record: TableReference) =>
                existingDatasetKeys.has(
                  JSON.stringify([record.schema, record.table_name]),
                ) ? (
                  <Tag color="warning">
                    {t('Already a dataset (will be skipped)')}
                  </Tag>
                ) : (
                  <Tag color="blue">{t('Ready to create')}</Tag>
                ),
            },
          ]}
          usePagination={false}
        />
        <div style={{ flex: 1, minHeight: 0 }}>{datasetPanelNode}</div>
      </Flex>
    ) : (
      datasetPanelNode
    );

  const FooterComponent = () => (
    <Footer
      url={prevUrl}
      datasetObject={dataset}
      hasColumns={hasColumns}
      datasets={previewDatasetNames}
      onBusyChange={setCreatingDatasets}
      busy={creatingDatasets}
      allSelectedExist={allSelectedExist}
      onUpdateSelectedTables={(tables: TableReference[]) =>
        setDataset({
          type: DatasetActionType.SelectTableReferences,
          payload: tables,
        })
      }
      onRegistered={() => setRegistrationVersion(version => version + 1)}
    />
  );

  return (
    <DatasetLayout
      header={HeaderComponent()}
      leftPanel={editPageIsVisible ? null : LeftPanelComponent()}
      datasetPanel={
        editPageIsVisible ? EditPageComponent() : DatasetPanelComponent()
      }
      footer={FooterComponent()}
    />
  );
}
