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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import { Collapse } from '.';
import type { CollapseProps } from './types';

function renderCollapse(props?: CollapseProps) {
  return render(
    <Collapse
      {...props}
      items={[
        {
          key: '1',
          label: 'Header 1',
          children: 'Content 1',
        },
        {
          key: '2',
          label: 'Header 2',
          children: 'Content 2',
        },
      ]}
    />,
  );
}

test('renders collapsed with default props', () => {
  renderCollapse();

  const headers = screen.getAllByRole('button');

  expect(headers[0]).toHaveTextContent('Header 1');
  expect(headers[1]).toHaveTextContent('Header 2');
  expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
  expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
});

test('renders with one item expanded by default', () => {
  renderCollapse({ defaultActiveKey: ['1'] });

  const headers = screen.getAllByRole('button');

  expect(headers[0]).toHaveTextContent('Header 1');
  expect(headers[1]).toHaveTextContent('Header 2');
  expect(screen.getByText('Content 1')).toBeInTheDocument();
  expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
});

test('expands on click', async () => {
  renderCollapse();

  expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
  expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

  await userEvent.click(screen.getAllByRole('button')[0]);

  expect(screen.getByText('Content 1')).toBeInTheDocument();
  expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
});

test('collapses on click', async () => {
  renderCollapse({ defaultActiveKey: ['1'] });

  expect(screen.getByText('Content 1')).toBeInTheDocument();
  expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

  await userEvent.click(screen.getAllByRole('button')[0]);

  expect(screen.getByText('Content 1').parentNode).toHaveClass(
    'ant-collapse-content-hidden',
  );
  expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
});
