import { render, fireEvent, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TreeSelect from '.';

const treeData = [
  {
    title: 'Node1',
    value: '0-0',
    children: [
      {
        title: 'Child Node1',
        value: '0-0-0',
      },
      {
        title: 'Child Node2',
        value: '0-0-1',
      },
    ],
  },
  {
    title: 'Node2',
    value: '0-1',
    children: [
      {
        title: 'Child Node3',
        value: '0-1-0',
      },
    ],
  },
];

describe('TreeSelect Component', () => {
  it('should render TreeSelect correctly', () => {
    render(
      <TreeSelect
        treeData={treeData}
        treeCheckable
        showCheckedStrategy={TreeSelect.SHOW_PARENT}
        placeholder="Please select"
        style={{ width: '300px' }}
      />,
    );
    expect(screen.getByText('Please select')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Please select'));
  });
});
