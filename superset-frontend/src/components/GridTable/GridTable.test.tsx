import { render } from 'spec/helpers/testing-library';
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

test('renders a grid with 3 Table rows', () => {
  const { queryByText } = render(<GridTable {...mockedProps} />);
  mockedProps.data.forEach(({ b: columnBContent }) => {
    expect(queryByText(columnBContent)).toBeTruthy();
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
