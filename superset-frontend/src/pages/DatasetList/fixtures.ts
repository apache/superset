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

export const mockUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
};

export const mockAdminUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
  roles: ['Admin'],
};

export const mockOwner = {
  id: 1,
  username: 'admin',
  first_name: 'Admin',
  last_name: 'User',
};

export const mockOtherOwner = {
  id: 2,
  username: 'analyst',
  first_name: 'Data',
  last_name: 'Analyst',
};

export const mockDatabase = {
  id: 1,
  database_name: 'examples',
};

export const mockOtherDatabase = {
  id: 2,
  database_name: 'production',
};

export const mockPhysicalDataset = {
  id: 1,
  table_name: 'birth_names',
  kind: 'physical',
  database: mockDatabase,
  schema: 'public',
  owners: [mockOwner],
  changed_on_delta_humanized: '2 days ago',
  changed_by: 'admin',
  explore_url: '/explore/?dataset_type=table&dataset_id=1',
  description: 'Birth names dataset for testing',
  extra: JSON.stringify({}),
};

export const mockVirtualDataset = {
  id: 2,
  table_name: 'virtual_dataset',
  kind: 'virtual',
  database: mockDatabase,
  schema: null,
  owners: [mockOwner],
  changed_on_delta_humanized: '1 day ago',
  changed_by: 'admin',
  explore_url: '/explore/?dataset_type=table&dataset_id=2',
  description: 'Virtual dataset for testing',
  sql: 'SELECT * FROM birth_names WHERE year > 2000',
  extra: JSON.stringify({}),
};

export const mockCertifiedDataset = {
  id: 3,
  table_name: 'certified_dataset',
  kind: 'physical',
  database: mockOtherDatabase,
  schema: 'analytics',
  owners: [mockOtherOwner],
  changed_on_delta_humanized: '5 hours ago',
  changed_by: 'analyst',
  explore_url: '/explore/?dataset_type=table&dataset_id=3',
  description: 'Certified dataset for production use',
  extra: JSON.stringify({
    certification: {
      certified_by: 'Data Team',
      details: 'Certified for production use. Contact data team for questions.',
    },
  }),
};

export const mockDatasetWithWarning = {
  id: 4,
  table_name: 'deprecated_dataset',
  kind: 'physical',
  database: mockDatabase,
  schema: 'legacy',
  owners: [mockOwner],
  changed_on_delta_humanized: '1 week ago',
  changed_by: 'admin',
  explore_url: '/explore/?dataset_type=table&dataset_id=4',
  description: 'Dataset with warning message',
  extra: JSON.stringify({
    warning_markdown: 'This dataset is deprecated and will be removed soon.',
  }),
};

export const mockDatasets = [
  mockPhysicalDataset,
  mockVirtualDataset,
  mockCertifiedDataset,
  mockDatasetWithWarning,
];

export const mockEmptyDatasetResponse = {
  result: [],
  count: 0,
};

export const mockDatasetResponse = {
  result: mockDatasets,
  count: mockDatasets.length,
};

export const mockPaginatedDatasetResponse = {
  result: mockDatasets.slice(0, 2),
  count: mockDatasets.length,
};

export const mockDatasetDetail = {
  id: 1,
  table_name: 'birth_names',
  kind: 'physical',
  database: mockDatabase,
  schema: 'public',
  owners: [mockOwner],
  columns: [
    {
      id: 1,
      column_name: 'name',
      type: 'VARCHAR(255)',
      groupby: true,
      filterable: true,
      description: 'Name column',
      extra: JSON.stringify({}),
    },
    {
      id: 2,
      column_name: 'year',
      type: 'INTEGER',
      groupby: true,
      filterable: true,
      description: 'Year column',
      extra: JSON.stringify({}),
    },
  ],
  metrics: [
    {
      id: 1,
      metric_name: 'count',
      metric_type: 'count',
      expression: 'COUNT(*)',
      description: 'Count of records',
    },
  ],
  description: 'Birth names dataset for testing',
  extra: JSON.stringify({}),
};

export const mockRelatedObjects = {
  charts: [
    {
      id: 1,
      slice_name: 'Test Chart',
      viz_type: 'table',
    },
  ],
  dashboards: [
    {
      id: 1,
      dashboard_title: 'Test Dashboard',
    },
  ],
};

export const mockEmptyRelatedObjects = {
  charts: [],
  dashboards: [],
};

export const mockDatabaseOptions = [
  { label: 'examples', value: 1 },
  { label: 'production', value: 2 },
];

export const mockSchemaOptions = [
  { label: 'public', value: 'public' },
  { label: 'analytics', value: 'analytics' },
  { label: 'legacy', value: 'legacy' },
];

export const mockOwnerOptions = [
  { label: 'Admin User', value: 1 },
  { label: 'Data Analyst', value: 2 },
];

export const mockToasts = {
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  addInfoToast: jest.fn(),
  addWarningToast: jest.fn(),
};
