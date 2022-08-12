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
import React from 'react';
import Header from './Header';
import DatasetPanel from './DatasetPanel';
import LeftPanel from './LeftPanel';
import Footer from './Footer';
import { DatasetActionType, DatasetObject, DSReducerActionType } from './types';
import DatasetLayout from '../DatasetLayout';

export function datasetReducer(
  state: Partial<DatasetObject> | null,
  action: DSReducerActionType,
): Partial<DatasetObject> | null {
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
        ...action.payload,
        table_name: null,
      };
    case DatasetActionType.selectTable:
      return {
        ...trimmedState,
        ...action.payload,
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

export default function AddDataset() {
  // this is commented out for now, but can be commented in as the component
  // is built up. Uncomment the useReducer in imports too
  // const [dataset, setDataset] = useReducer<
  //   Reducer<Partial<DatasetObject> | null, DSReducerActionType>
  // >(datasetReducer, null);

  return (
    <DatasetLayout
      header={Header()}
      leftPanel={LeftPanel()}
      datasetPanel={DatasetPanel()}
      footer={Footer()}
    />
  );
}
