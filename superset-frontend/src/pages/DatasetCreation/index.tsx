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
import { useCallback, useEffect, useReducer, useState } from 'react';
import { useParams } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { Flex, Table } from '@superset-ui/core/components';
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

  const { datasets, datasetNames } = useDatasetsList(
    dataset?.db,
    dataset?.schema,
    registrationVersion,
    dataset?.catalog,
  );

  const { datasetId: id } = useParams<{ datasetId: string }>();
  const editPageIsVisible = !Number.isNaN(parseInt(id, 10));
  const handleTableSelection = useCallback((table: TableReference) => {
    setPreviewTable(table);
    const schema = table.schema || null;
    setDataset({
      type: DatasetActionType.SelectSchema,
      payload: { name: 'schema', value: schema },
    });
    setDataset({
      type: DatasetActionType.SelectTable,
      payload: { name: 'table_name', value: table.table_name },
    });
  }, []);

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
      onBusyChange={setCreatingDatasets}
      onPreviewTable={handleTableSelection}
      onDatasetCreated={() => setRegistrationVersion(version => version + 1)}
    />
  );

  const EditPageComponent = () => <EditPage id={id} />;

  const activePreview = dataset?.table_name
    ? { schema: dataset.schema ?? '', table_name: dataset.table_name }
    : previewTable;

  const DatasetPanelComponent = () => (
    <Flex vertical gap="middle">
      {(dataset?.selected_tables?.length ?? 0) > 1 && (
        <Table
          rowKey={table => JSON.stringify([table.schema, table.table_name])}
          data={dataset?.selected_tables ?? []}
          columns={[
            { title: t('Schema'), dataIndex: 'schema' },
            { title: t('Selected table or view'), dataIndex: 'table_name' },
          ]}
          usePagination={false}
        />
      )}
      <DatasetPanel
        tableName={activePreview?.table_name}
        dbId={dataset?.db?.id}
        catalog={dataset?.catalog}
        schema={activePreview?.schema}
        database={dataset?.db}
        setHasColumns={setHasColumns}
        datasets={activePreview?.schema === dataset?.schema ? datasets : []}
      />
    </Flex>
  );

  const FooterComponent = () => (
    <Footer
      url={prevUrl}
      datasetObject={dataset}
      hasColumns={hasColumns}
      datasets={datasetNames}
      onBusyChange={setCreatingDatasets}
      busy={creatingDatasets}
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
