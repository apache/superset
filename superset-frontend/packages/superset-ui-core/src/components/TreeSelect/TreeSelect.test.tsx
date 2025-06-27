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
import { render, fireEvent, screen } from '@superset-ui/core/spec';
import '@testing-library/jest-dom';
import { TreeSelect } from '.';

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
