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
import { FolderBreadcrumb } from './FolderBreadcrumb';
import type { FolderBreadcrumbItem } from './types';

const items: FolderBreadcrumbItem[] = [
  { key: 'root', title: 'All assets' },
  { key: 'analytics', title: 'Analytics' },
  { key: 'sales', title: 'Sales' },
];

test('renders every segment in order', () => {
  render(<FolderBreadcrumb items={items} />);

  expect(screen.getByText('All assets')).toBeInTheDocument();
  expect(screen.getByText('Analytics')).toBeInTheDocument();
  expect(screen.getByText('Sales')).toBeInTheDocument();
});

test('renders the default ">" separator between segments', () => {
  render(<FolderBreadcrumb items={items} />);

  expect(screen.getAllByText('>')).toHaveLength(items.length - 1);
});

test('renders a custom separator', () => {
  render(<FolderBreadcrumb items={items} separator="/" />);

  expect(screen.getAllByText('/')).toHaveLength(items.length - 1);
  expect(screen.queryByText('>')).not.toBeInTheDocument();
});

test('marks the trailing segment as current with the open-folder icon', () => {
  render(<FolderBreadcrumb items={items} />);

  // Ancestors get the closed-folder icon; the current leaf gets the open one.
  expect(screen.getAllByTestId('folder')).toHaveLength(items.length - 1);
  expect(screen.getByTestId('folder-open')).toBeInTheDocument();
});

test('omits the icon for a segment with hideIcon', () => {
  render(
    <FolderBreadcrumb
      items={[
        { key: 'root', title: 'All assets', hideIcon: true },
        { key: 'sales', title: 'Sales' },
      ]}
    />,
  );

  // The only icon left is the current leaf's open-folder icon.
  expect(screen.queryByTestId('folder')).not.toBeInTheDocument();
  expect(screen.getByTestId('folder-open')).toBeInTheDocument();
});

test('invokes onClick with the segment key', async () => {
  const onClick = jest.fn();
  render(
    <FolderBreadcrumb
      items={[
        { key: 'root', title: 'All assets', onClick },
        { key: 'sales', title: 'Sales' },
      ]}
    />,
  );

  await userEvent.click(screen.getByText('All assets'));

  expect(onClick).toHaveBeenCalledWith('root');
});
