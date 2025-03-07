import { render, screen, fireEvent } from '@testing-library/react';
import Tree from './index';

const treeData = [
  {
    title: 'Parent 1',
    key: '0-0',
    children: [
      { title: 'Child 1', key: '0-0-0' },
      { title: 'Child 2', key: '0-0-1' },
    ],
  },
];

describe('Tree Component', () => {
  test('renders tree component correctly', () => {
    render(<Tree treeData={treeData} />);
    expect(screen.getByText('Parent 1')).toBeInTheDocument();
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  test('expands and collapses nodes on click', () => {
    render(<Tree treeData={treeData} defaultExpandAll={false} />);

    const parentNode = screen.getByText('Parent 1');
    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();

    fireEvent.click(parentNode);
    expect(screen.getByText('Child 1')).toBeInTheDocument();

    fireEvent.click(parentNode);
    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
  });

  test('selects a node when clicked', () => {
    const onSelect = jest.fn();
    render(<Tree treeData={treeData} onSelect={onSelect} />);

    const childNode = screen.getByText('Child 1');
    fireEvent.click(childNode);

    expect(onSelect).toHaveBeenCalled();
  });
});
