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
import { render, screen, fireEvent } from '@superset-ui/core/spec';
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
  it('expands and collapses parent node', async () => {
    render(<Tree treeData={treeData} defaultExpandAll={false} />);

    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Child 2')).not.toBeInTheDocument();

    const toogleNode = screen.getByRole('img', { name: 'caret-down' });
    fireEvent.click(toogleNode);

    expect(await screen.findByText('Child 1')).toBeInTheDocument();
    expect(await screen.findByText('Child 2')).toBeInTheDocument();

    fireEvent.click(toogleNode);

    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Child 2')).not.toBeInTheDocument();
  });
});
