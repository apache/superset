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
import ResizableTable, {
  ResizableTableProps,
  EmptyWrapperType,
} from './ResizableTable';

export default {
  title: 'ResizableTable',
  component: ResizableTable,
};

export const InteractiveResizableTable = (args: ResizableTableProps) => (
  <>
      <span>SEARCH:</span> 
    <ResizableTable {...args} />
  </>
);

InteractiveResizableTable.args = {
  columns: [
    {
      accessor: 'id',
      Header: 'ID',
      sortable: true,
    },
    {
      accessor: 'age',
      Header: 'Age',
    },
    {
      accessor: 'name',
      Header: 'Name',
    },
  ],
  data: [
    { id: 423, age: 7, name: 'Don' },
    { id: 351, age: 20, name: 'Kit' },
    { id: 133, age: 47, name: 'Emi' },
    { id: 391, age: 30, name: 'Alex' },
    { id: 103, age: 37, name: 'Joe' },
    { id: 381, age: 50, name: 'Clare' },
    { id: 153, age: 17, name: 'Frank' },
    { id: 301, age: 70, name: 'Bob' },
    { id: 223, age: 97, name: 'Celeste' },
    { id: 221, age: 30, name: 'Marian' },
    { id: 423, age: 27, name: 'Jake' },
    { id: 323, age: 70, name: 'John' },
    { id: 124, age: 67, name: 'Fred' },
    { id: 325, age: 60, name: 'Maria' },
    { id: 126, age: 57, name: 'Emily' },
    { id: 327, age: 11, name: 'Kate' },
  ],
  initialSortBy: [{ id: 'name', desc: true }],
  noDataText: 'No data here',
  showRowCount: true,
    scrollTable: true,
};

InteractiveResizableTable.argTypes = {
  emptyWrapperType: {
    control: {
      type: 'select',
      options: [EmptyWrapperType.Default, EmptyWrapperType.Small],
    },
  },
  pageSize: {
    control: {
      type: 'number',
      min: 1,
    },
  },
  initialPageIndex: {
    control: {
      type: 'number',
      min: 0,
    },
  },
};

InteractiveResizableTable.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
