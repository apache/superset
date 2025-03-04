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
import { render } from 'spec/helpers/testing-library';
import { setupAGGridModules } from 'src/setup/setupAGGridModules';
import GridTable from '.';

jest.mock('src/components/ErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedProps = {
  queryId: 'abc',
  columns: ['a', 'b', 'c'].map(key => ({
    key,
    label: key,
    headerName: key,
    render: ({ value }: { value: any }) => value,
  })),
  data: [
    { a: 'a1', b: 'b1', c: 'c1', d: 0 },
    { a: 'a2', b: 'b2', c: 'c2', d: 100 },
    { a: null, b: 'b3', c: 'c3', d: 50 },
  ],
  height: 500,
};

beforeAll(() => {
  setupAGGridModules();
});

test('renders a grid with 3 Table rows', () => {
  const { queryByText } = render(<GridTable {...mockedProps} />);
  mockedProps.data.forEach(({ b: columnBContent }) => {
    expect(queryByText(columnBContent)).toBeInTheDocument();
  });
});

test('sorts strings correctly', () => {
  const stringProps = {
    ...mockedProps,
    columns: ['columnA'].map(key => ({
      key,
      label: key,
      headerName: key,
      render: ({ value }: { value: any }) => value,
    })),
    data: [{ columnA: 'Bravo' }, { columnA: 'Alpha' }, { columnA: 'Charlie' }],
    height: 500,
  };
  const { container } = render(<GridTable {...stringProps} />);

  // Original order
  expect(container).toHaveTextContent(['Bravo', 'Alpha', 'Charlie'].join(''));
});
