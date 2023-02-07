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
import React, { useReducer, Reducer, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDatasetsList } from 'src/views/CRUD/data/hooks';
import Header from 'src/features/datasets/Header';
import DatasetEditPanel from 'src/pages/DatasetEditPanel';
import DatasetCreationPanel from 'src/pages/DatasetCreationPanel';
import LeftPanel from 'src/features/datasets/LeftPanel';
import Footer from 'src/features/datasets/Footer';
import {
  DatasetActionType,
  NewDatasetObject,
  DSReducerActionType,
} from 'src/pages/Dataset/types';
import DatasetLayout from 'src/features/datasets/DatasetLayout';

type Schema = {
  schema: string;
};

export function datasetReducer(
  state: NewDatasetObject | null,
  action: DSReducerActionType,
): Partial<NewDatasetObject> | Schema | null {
  const trimmedState = {
    ...(state || {}),
  };

  switch (action.type) {
    case DatasetActionType.selectDatabase:
      return {
        ...trimmedState,
        ...action.payload,
        schema: null,
        table_name: null,
      };
    case DatasetActionType.selectSchema:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
        table_name: null,
      };
    case DatasetActionType.selectTable:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
      };
    case DatasetActionType.changeDataset:
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

export default function DatasetPage() {
  const [dataset, setDataset] = useReducer<
    Reducer<Partial<NewDatasetObject> | null, DSReducerActionType>
  >(datasetReducer, null);
  const [hasColumns, setHasColumns] = useState(false);
  const [datasetEditPanelIsVisible, setDatasetEditPanelIsVisible] =
    useState(false);

  const { datasets, datasetNames } = useDatasetsList(
    dataset?.db,
    dataset?.schema,
  );

  const { datasetId: id } = useParams<{ datasetId: string }>();
  useEffect(() => {
    if (!Number.isNaN(parseInt(id, 10))) {
      setDatasetEditPanelIsVisible(true);
    }
  }, [id]);

  const HeaderComponent = () => (
    <Header setDataset={setDataset} title={dataset?.table_name} />
  );

  const LeftPanelComponent = () => (
    <LeftPanel
      setDataset={setDataset}
      dataset={dataset}
      datasetNames={datasetNames}
    />
  );

  const DatasetEditPanelComponent = () => <DatasetEditPanel id={id} />;

  const DatasetCreationPanelComponent = () => (
    <DatasetCreationPanel
      tableName={dataset?.table_name}
      dbId={dataset?.db?.id}
      schema={dataset?.schema}
      setHasColumns={setHasColumns}
      datasets={datasets}
    />
  );

  const FooterComponent = () => (
    <Footer
      url={prevUrl}
      datasetObject={dataset}
      hasColumns={hasColumns}
      datasets={datasetNames}
    />
  );

  return (
    <DatasetLayout
      header={HeaderComponent()}
      leftPanel={datasetEditPanelIsVisible ? null : LeftPanelComponent()}
      datasetPanel={
        datasetEditPanelIsVisible
          ? DatasetEditPanelComponent()
          : DatasetCreationPanelComponent()
      }
      footer={FooterComponent()}
    />
  );
}
