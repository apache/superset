import type { Column, GridApi } from 'ag-grid-community';
import { act, fireEvent, render } from 'spec/helpers/testing-library';
import Header, { PIVOT_COL_ID } from './Header';

jest.mock('src/components/Dropdown', () => ({
  Dropdown: () => <div data-test="mock-dropdown" />,
}));

jest.mock('src/components/Icons', () => ({
  Sort: () => <div data-test="mock-sort" />,
  SortAsc: () => <div data-test="mock-sort-asc" />,
  SortDesc: () => <div data-test="mock-sort-desc" />,
}));

class MockApi extends EventTarget {
  getAllDisplayedColumns() {
    return [];
  }
}

const mockedProps = {
  displayName: 'test column',
  setSort: jest.fn(),
  column: {
    getColId: () => '123',
    isPinnedLeft: () => true,
    isPinnedRight: () => false,
    getSort: () => 'asc',
    getSortIndex: () => null,
  } as any as Column,
  api: new MockApi() as any as GridApi,
};

test('renders display name for the column', () => {
  const { queryByText } = render(<Header {...mockedProps} />);
  expect(queryByText(mockedProps.displayName)).toBeTruthy();
});

test('sorts by clicking a column header', () => {
  const { getByText, queryByTestId } = render(<Header {...mockedProps} />);
  fireEvent.click(getByText(mockedProps.displayName));
  expect(mockedProps.setSort).toBeCalledWith('asc', false);
  expect(queryByTestId('mock-sort-asc')).toBeInTheDocument();
  fireEvent.click(getByText(mockedProps.displayName));
  expect(mockedProps.setSort).toBeCalledWith('desc', false);
  expect(queryByTestId('mock-sort-desc')).toBeInTheDocument();
  fireEvent.click(getByText(mockedProps.displayName));
  expect(mockedProps.setSort).toBeCalledWith(null, false);
  expect(queryByTestId('mock-sort-asc')).not.toBeInTheDocument();
  expect(queryByTestId('mock-sort-desc')).not.toBeInTheDocument();
});

test('synchronizes the current sort when sortChanged event occured', async () => {
  const { findByTestId } = render(<Header {...mockedProps} />);
  act(() => {
    mockedProps.api.dispatchEvent(new Event('sortChanged'));
  });
  const sortAsc = await findByTestId('mock-sort-asc');
  expect(sortAsc).toBeInTheDocument();
});

test('disable menu when enableMenu is false', () => {
  const { queryByText, queryByTestId } = render(
    <Header {...mockedProps} enableMenu={false} />,
  );
  expect(queryByText(mockedProps.displayName)).toBeTruthy();
  expect(queryByTestId('mock-dropdown')).toBeFalsy();
});

test('hide display name for PIVOT_COL_ID', () => {
  const { queryByText } = render(
    <Header
      {...mockedProps}
      column={
        {
          getColId: () => PIVOT_COL_ID,
          isPinnedLeft: () => true,
          isPinnedRight: () => false,
          getSortIndex: () => null,
        } as any as Column
      }
    />,
  );
  expect(queryByText(mockedProps.displayName)).not.toBeInTheDocument();
});
