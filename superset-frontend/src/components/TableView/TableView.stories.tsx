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
import TableView, { TableViewProps, EmptyWrapperType } from '.';

export default {
  title: 'TableView',
  component: TableView,
};

export const InteractiveTableView = (args: TableViewProps) => (
  <TableView {...args} />
);

InteractiveTableView.args = {
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
    { id: 123, age: 27, name: 'Emily' },
    { id: 321, age: 10, name: 'Kate' },
  ],
  initialSortBy: [{ id: 'name', desc: true }],
  noDataText: 'No data here',
  pageSize: 1,
  showRowCount: true,
  withPagination: true,
};

InteractiveTableView.argTypes = {
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

InteractiveTableView.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
