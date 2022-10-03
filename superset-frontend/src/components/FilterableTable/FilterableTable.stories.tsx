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
import FilterableTable, { FilterableTableProps } from '.';

export default {
  title: 'FilterableTable',
  component: FilterableTable,
};

export const InteractiveTable = (args: FilterableTableProps) => (
  <div css={{ maxWidth: 700 }}>
    <FilterableTable {...args} />
  </div>
);

InteractiveTable.args = {
  filterText: '',
  orderedColumnKeys: ['id', 'name', 'age', 'location'],
  data: [
    {
      id: 1,
      name: 'John',
      age: 32,
      location: { city: 'Barcelona', country: 'Spain' },
    },
    {
      id: 2,
      name: 'Mary',
      age: 53,
      location: { city: 'Madrid', country: 'Spain' },
    },
    {
      id: 3,
      name: 'Peter',
      age: 60,
      location: { city: 'Paris', country: 'France' },
    },
  ],
  height: 300,
  headerHeight: 30,
  overscanColumnCount: 0,
  overscanRowCount: 0,
  rowHeight: 30,
  striped: true,
  expandedColumns: [],
};

InteractiveTable.argTypes = {};

InteractiveTable.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
