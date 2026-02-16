import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ActionLogList from './index';


jest.mock('src/views/CRUD/hooks', () => ({
  useListViewResource: () => ({
    state: {
      loading: false,
      resourceCount: 1,
      resourceCollection: [
        {
          action: 'test',
          user: {
            username: 'guid-123',
            first_name: 'John',
            last_name: 'Doe',
          },
        },
      ],
      bulkSelectEnabled: false,
    },
    fetchData: jest.fn(),
    refreshData: jest.fn(),
    toggleBulkSelect: jest.fn(),
  }),
}));

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: any) => Component,
  useToasts: () => ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
  }),
}));

jest.mock('src/features/home/SubMenu', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('src/components/ListView', () => ({
  __esModule: true,
  ListView: ({ data }: any) => (
    <div>
      {data.map((row: any) => (
        <div key={row.user.username}>
          {row.user.first_name} {row.user.last_name}
        </div>
      ))}
    </div>
  ),
  ListViewFilterOperator: {
    RelationOneMany: 'RelationOneMany',
    Equals: 'Equals',
    Contains: 'Contains',
    Between: 'Between',
  },
}));

describe('ActionLog User column display', () => {
  it('renders full name when first_name and last_name exist', () => {
    render(<ActionLogList />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
