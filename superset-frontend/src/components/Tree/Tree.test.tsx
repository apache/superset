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
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
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
    render(<Tree treeData={treeData} defaultExpandAll />);

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
