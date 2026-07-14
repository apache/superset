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
import type { Column, GridApi, IHeaderParams } from 'ag-grid-community';
import { act, fireEvent, render } from 'spec/helpers/testing-library';
import { Header } from './Header';
import { PIVOT_COL_ID } from './constants';

jest.mock('@superset-ui/core/components/Dropdown', () => ({
  Dropdown: () => <div data-test="mock-dropdown" />,
}));

jest.mock('@superset-ui/core/components/Icons', () => {
  const actualIcons = jest.requireActual('@superset-ui/core/components/Icons');
  return {
    __esModule: true,
    Icons: {
      ...actualIcons.Icons, // retain the real `Icons` export
      Sort: jest.fn(() => <div data-test="mock-sort" />),
      SortAsc: jest.fn(() => <div data-test="mock-sort-asc" />),
      SortDesc: jest.fn(() => <div data-test="mock-sort-desc" />),
    },
  };
});

class MockColumn {
  private colListeners = new Map<string, Set<Function>>();

  sortValue: string | null = 'asc';

  sortIndexValue: number | null = null;

  getColId() {
    return '123';
  }

  isPinnedLeft() {
    return true;
  }

  isPinnedRight() {
    return false;
  }

  isVisible() {
    return true;
  }

  getSort() {
    return this.sortValue;
  }

  getSortIndex() {
    return this.sortIndexValue;
  }

  addEventListener(eventType: string, listener: Function) {
    if (!this.colListeners.has(eventType)) {
      this.colListeners.set(eventType, new Set());
    }
    this.colListeners.get(eventType)!.add(listener);
  }

  removeEventListener(eventType: string, listener: Function) {
    this.colListeners.get(eventType)?.delete(listener);
  }

  triggerEvent(eventType: string) {
    this.colListeners.get(eventType)?.forEach(listener => listener({}));
  }
}

class MockOtherColumn extends MockColumn {
  getColId() {
    return 'other-col';
  }
}

class MockApi {
  mockColumn = new MockColumn();

  otherColumn = new MockOtherColumn();

  getAllDisplayedColumns() {
    return [this.mockColumn, this.otherColumn];
  }

  getColumns() {
    return [this.mockColumn, this.otherColumn];
  }

  isDestroyed() {
    return false;
  }
}

const mockApi = new MockApi();

const mockedProps = {
  displayName: 'test column',
  progressSort: jest.fn(),
  enableSorting: true,
  column: mockApi.mockColumn as any as Column,
  api: mockApi as any as GridApi,
} as unknown as IHeaderParams;

test('renders display name for the column', () => {
  const { queryByText } = render(<Header {...mockedProps} />);
  expect(queryByText(mockedProps.displayName)).toBeInTheDocument();
});

test('calls progressSort without shiftKey on click', () => {
  const { getByText } = render(<Header {...mockedProps} />);
  fireEvent.click(getByText(mockedProps.displayName));
  expect(mockedProps.progressSort).toHaveBeenCalledWith(false);
});

test('calls progressSort with shiftKey on shift-click', () => {
  const { getByText } = render(<Header {...mockedProps} />);
  fireEvent.click(getByText(mockedProps.displayName), { shiftKey: true });
  expect(mockedProps.progressSort).toHaveBeenCalledWith(true);
});

test('synchronizes sort icon when columnStateUpdated fires on column', async () => {
  const { findByTestId, queryByTestId } = render(<Header {...mockedProps} />);
  expect(queryByTestId('mock-sort-asc')).not.toBeInTheDocument();

  act(() => {
    mockApi.mockColumn.triggerEvent('columnStateUpdated');
  });

  const sortAsc = await findByTestId('mock-sort-asc');
  expect(sortAsc).toBeInTheDocument();
});

test('shows sortIndex label when multi-sort is active', async () => {
  const { findByText } = render(<Header {...mockedProps} />);

  act(() => {
    mockApi.mockColumn.sortIndexValue = 1;
    mockApi.otherColumn.sortValue = 'desc';
    mockApi.mockColumn.triggerEvent('columnStateUpdated');
  });

  const label = await findByText('2');
  expect(label).toBeInTheDocument();
});

test('hides sortIndex label when multi-sort is cleared', async () => {
  const { queryByText } = render(<Header {...mockedProps} />);

  act(() => {
    mockApi.mockColumn.sortIndexValue = 1;
    mockApi.otherColumn.sortValue = 'desc';
    mockApi.mockColumn.triggerEvent('columnStateUpdated');
  });

  act(() => {
    mockApi.mockColumn.sortIndexValue = null;
    mockApi.otherColumn.sortValue = null;
    mockApi.mockColumn.triggerEvent('columnStateUpdated');
  });

  expect(queryByText('2')).not.toBeInTheDocument();
});

test('disable menu when enableFilterButton is false', () => {
  const { queryByText, queryByTestId } = render(
    <Header {...mockedProps} enableFilterButton={false} />,
  );
  expect(queryByText(mockedProps.displayName)).toBeInTheDocument();
  expect(queryByTestId('mock-dropdown')).not.toBeInTheDocument();
});

test('hide display name for PIVOT_COL_ID', () => {
  const pivotColumn = new MockColumn();
  (pivotColumn as any).getColId = () => PIVOT_COL_ID;

  const { queryByText } = render(
    <Header {...mockedProps} column={pivotColumn as any as Column} />,
  );
  expect(queryByText(mockedProps.displayName)).not.toBeInTheDocument();
});

test('does not attach click handler when enableSorting is false', () => {
  const { getByText } = render(
    <Header {...mockedProps} enableSorting={false} />,
  );
  const cell = getByText(mockedProps.displayName).closest(
    '.ag-header-cell-label',
  );
  expect(cell).not.toHaveAttribute('role', 'button');
});

test('does not call progressSort on click when enableSorting is false', () => {
  const progressSort = jest.fn();
  const { getByText } = render(
    <Header
      {...mockedProps}
      enableSorting={false}
      progressSort={progressSort}
    />,
  );
  fireEvent.click(getByText(mockedProps.displayName));
  expect(progressSort).not.toHaveBeenCalled();
});

test('does not render sort icons when enableSorting is false', () => {
  const { queryByTestId } = render(
    <Header {...mockedProps} enableSorting={false} />,
  );
  expect(queryByTestId('mock-sort')).not.toBeInTheDocument();
  expect(queryByTestId('mock-sort-asc')).not.toBeInTheDocument();
  expect(queryByTestId('mock-sort-desc')).not.toBeInTheDocument();
});
