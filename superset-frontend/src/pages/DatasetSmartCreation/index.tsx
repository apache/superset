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
import React, { useReducer, Reducer, useEffect, useState, ReactElement, JSXElementConstructor } from 'react';
import useDatasetsList from 'src/features/datasets/hooks/useDatasetLists';
import Header from 'src/features/datasets/AddDataset/Header';
import DatasetPanel from 'src/features/datasets/AddDataset/DatasetPanel';
import LeftPanel from 'src/features/datasets/AddDataset/LeftPanel';
import {
  DatasetActionType,
  DatasetObject,
  DSReducerActionType,
} from 'src/features/datasets/AddDataset/types';
import DatasetLayout from 'src/features/datasets/DatasetLayout';
import { TableOption } from 'src/components/TableSelector';

type Schema = {
  schema: string;
};

export function datasetSmartReducer(
  state: DatasetObject | null,
  action: DSReducerActionType,
): Partial<DatasetObject> | Schema | null {
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

export type TableJoin = {
  sourceTable: string;
  sourceColumn: string;
  joinTable: string;
  joinColumn: string;
};

type AddSmartDatasetProps = {
  onSqlChange: (sql: string) => void;
}

export default function AddSmartDataset({ onSqlChange }: AddSmartDatasetProps) {
  const [dataset, setDataset] = useReducer<
    Reducer<Partial<DatasetObject> | null, DSReducerActionType>
  >(datasetSmartReducer, null);
  const [tableOptions, setTableOptions] = useState<Array<TableOption>>([]);
  const [joins, setJoins] = useState<TableJoin[]>([]);
  const [joinDatasetPanels, setJoinDatasetPanels] =
    useState<ReactElement<any, string | JSXElementConstructor<any>>[] | undefined>(undefined);

  const getTableName = (tableName: string) => `${dataset!.schema}.${tableName}`;

  useEffect(() => {
    const tableName = dataset?.table_name;
    if (!joins.length) {
      if (tableName) {
        onSqlChange(`select * from ${getTableName(tableName)}`);
      }
      return;
    }

    const joinDatasetPanelsToAdd = joins.map(join => getDatasetPanelComponent(join.joinTable));
    setJoinDatasetPanels(joinDatasetPanelsToAdd);

    if (!tableName) {
      return;
    }

    let sqlToSet = `select * from ${getTableName(tableName)}`;

    // TODO use reduce
    joins.forEach(join => {
      sqlToSet += ` join ${getTableName(join.joinTable)} on ${getTableName(join.sourceTable)}.${join.sourceColumn} = ${getTableName(join.joinTable)}.${join.joinColumn}`;
    });

    onSqlChange(sqlToSet);
  }, [joins]);

  const { datasets, datasetNames } = useDatasetsList(
    dataset?.db,
    dataset?.schema,
  );

  const removeTable = (tableName: string) => {
    // TODO impl
    console.log(joinDatasetPanels);
  };

  const getDatasetPanelComponent = (tableName: string | undefined | null) => (
    <DatasetPanel
      tableName={tableName}
      dbId={dataset?.db?.id}
      schema={dataset?.schema}
      datasets={datasets}
      smart={true}
      tablesInSchema={tableOptions}
      joins={joins}
      setJoins={setJoins}
      removeTable={removeTable}
    />
  );

  const HeaderComponent = () => (
    <Header setDataset={setDataset} title={dataset?.table_name} />
  );

  const LeftPanelComponent = () => (
    <LeftPanel
      setDataset={setDataset}
      dataset={dataset}
      datasetNames={datasetNames}
      tableOptions={tableOptions}
      setTableOptions={setTableOptions}
    />
  );

  const getInitialDatasetPanelComponent = () => getDatasetPanelComponent(dataset?.table_name);

  const getDatasetPanelComponents = () => {
    const panelComponents = [getInitialDatasetPanelComponent()];

    if (joinDatasetPanels) {
      panelComponents.push(...joinDatasetPanels)
    }

    return panelComponents;
  };

  return (
    <DatasetLayout
      header={HeaderComponent()}
      leftPanel={LeftPanelComponent()}
      datasetPanel={
        getDatasetPanelComponents()
      }
    />
  );
}

