import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Skeleton } from 'antd';

describe('Skeleton Component', () => {
  test('renders skeleton', () => {
    render(<Skeleton loading paragraph={{ rows: 3 }} active />);

    expect(screen.getByRole('list')).toHaveClass('ant-skeleton-paragraph');
  });

  test('renders skeleton with correct number of paragraph rows', () => {
    render(<Skeleton loading paragraph={{ rows: 3 }} active />);

    const paragraph = screen.getByRole('list');
    expect(paragraph.children.length).toBe(3);
  });

  test('does not render skeleton when loading is false', () => {
    render(
      <Skeleton loading={false} active>
        <p>Loaded Content</p>
      </Skeleton>,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Loaded Content')).toBeInTheDocument();
  });
});
