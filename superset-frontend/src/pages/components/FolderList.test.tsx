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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import { FolderList } from './FolderList';
import type { Folder } from './types';

const folders: Folder[] = [
  {
    key: 'sales',
    title: 'Sales',
    assets: [
      { key: 'd1', name: 'Revenue Overview', type: 'dashboard' },
      { key: 'ds1', name: 'opportunities', type: 'dataset' },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing',
    assets: [{ key: 'c1', name: 'Spend by Channel', type: 'chart' }],
  },
];

test('renders a header with the title and asset count for each folder', () => {
  render(<FolderList folders={folders} expandableTypes={['folder']} />);

  expect(screen.getByRole('button', { name: /Sales/ })).toHaveTextContent('2');
  expect(screen.getByRole('button', { name: /Marketing/ })).toHaveTextContent(
    '1',
  );
});

test('omits the asset count when showCount is false', () => {
  render(
    <FolderList
      folders={folders}
      expandableTypes={['folder']}
      showCount={false}
    />,
  );

  expect(screen.getByRole('button', { name: /Sales/ })).not.toHaveTextContent(
    '2',
  );
  expect(
    screen.getByRole('button', { name: /Marketing/ }),
  ).not.toHaveTextContent('1');
});

test('does not expand folders whose type is not in expandableTypes', () => {
  render(<FolderList folders={folders} />);

  // Headers still render, but there is no toggle and the assets stay hidden.
  expect(screen.getByText('Sales')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Sales/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Revenue Overview')).not.toBeInTheDocument();
});

test('keeps folder contents collapsed by default', () => {
  render(<FolderList folders={folders} expandableTypes={['folder']} />);

  expect(screen.queryByText('Revenue Overview')).not.toBeInTheDocument();
  expect(screen.queryByText('Spend by Channel')).not.toBeInTheDocument();
});

test('expands the folders named in defaultActiveKeys', () => {
  render(
    <FolderList
      folders={folders}
      expandableTypes={['folder']}
      defaultActiveKeys={['sales']}
    />,
  );

  expect(screen.getByText('Revenue Overview')).toBeInTheDocument();
  expect(screen.getByText('opportunities')).toBeInTheDocument();
  expect(screen.queryByText('Spend by Channel')).not.toBeInTheDocument();
});

test('reveals folder assets when its header is clicked', async () => {
  render(<FolderList folders={folders} expandableTypes={['folder']} />);

  await userEvent.click(screen.getByRole('button', { name: /Marketing/ }));

  expect(screen.getByText('Spend by Channel')).toBeInTheDocument();
});

test('calls onAssetClick with the clicked asset', async () => {
  const onAssetClick = jest.fn();
  render(
    <FolderList
      folders={folders}
      expandableTypes={['folder']}
      defaultActiveKeys={['sales']}
      onAssetClick={onAssetClick}
    />,
  );

  await userEvent.click(screen.getByText('Revenue Overview'));

  expect(onAssetClick).toHaveBeenCalledWith(folders[0].assets[0]);
});

test('accordion mode hides the open folder when another is opened', async () => {
  render(
    <FolderList
      folders={folders}
      expandableTypes={['folder']}
      defaultActiveKeys={['sales']}
      accordion
    />,
  );

  expect(screen.getByText('Revenue Overview')).toBeInTheDocument();

  // In accordion mode antd renders the headers as tabs rather than buttons.
  await userEvent.click(screen.getByRole('tab', { name: /Marketing/ }));

  expect(screen.getByText('Spend by Channel')).toBeInTheDocument();
  // antd keeps collapsed content mounted but flags it hidden.
  expect(
    screen.getByText('Revenue Overview').closest('.ant-collapse-content'),
  ).toHaveClass('ant-collapse-content-hidden');
});

test('calls onFolderClick when a non-expandable row is clicked', async () => {
  const onFolderClick = jest.fn();
  render(<FolderList folders={folders} onFolderClick={onFolderClick} />);

  await userEvent.click(screen.getByRole('button', { name: /Sales/ }));

  expect(onFolderClick).toHaveBeenCalledWith(folders[0]);
  // Clicking navigates rather than expanding, so the assets stay hidden.
  expect(screen.queryByText('Revenue Overview')).not.toBeInTheDocument();
});

test('renders custom expanded content instead of the asset list', () => {
  render(
    <FolderList
      folders={folders}
      expandableTypes={['folder']}
      defaultActiveKeys={['sales']}
      renderExpandedContent={folder => <div>preview of {folder.key}</div>}
    />,
  );

  expect(screen.getByText('preview of sales')).toBeInTheDocument();
  expect(screen.queryByText('Revenue Overview')).not.toBeInTheDocument();
});

test('expands only the types listed in expandableTypes', async () => {
  const mixed: Folder[] = [
    {
      key: 'sales',
      title: 'Sales',
      type: 'folder',
      assets: [{ key: 'd1', name: 'Revenue Overview', type: 'dashboard' }],
    },
    {
      key: 'kpis',
      title: 'KPIs',
      type: 'dashboard',
      assets: [{ key: 'c1', name: 'Active Users', type: 'chart' }],
    },
  ];
  const onFolderClick = jest.fn();
  render(
    <FolderList
      folders={mixed}
      expandableTypes={['folder']}
      defaultActiveKeys={['sales']}
      onFolderClick={onFolderClick}
    />,
  );

  // The folder expands in place; the dashboard row navigates on click.
  expect(screen.getByText('Revenue Overview')).toBeInTheDocument();
  expect(screen.queryByText('Active Users')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /KPIs/ }));

  expect(onFolderClick).toHaveBeenCalledWith(mixed[1]);
});
