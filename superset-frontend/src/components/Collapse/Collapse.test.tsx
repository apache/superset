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
import {
  render,
  screen,
  cleanup,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import Collapse, { CollapseProps } from '.';

describe('Collapse', () => {
  beforeAll(() => {
    jest.setTimeout(30000);
  });

  afterEach(async () => {
    cleanup();
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  function renderCollapse(props?: CollapseProps) {
    return render(
      <Collapse {...props}>
        <Collapse.Panel header="Header 1" key="1">
          Content 1
        </Collapse.Panel>
        <Collapse.Panel header="Header 2" key="2">
          Content 2
        </Collapse.Panel>
      </Collapse>,
    );
  }

  test('renders collapsed with default props', async () => {
    const { unmount } = renderCollapse();
    const headers = screen.getAllByRole('button');

    expect(headers[0]).toHaveTextContent('Header 1');
    expect(headers[1]).toHaveTextContent('Header 2');
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

    unmount();
  });

  test('renders with one item expanded by default', async () => {
    const { unmount } = renderCollapse({ defaultActiveKey: ['1'] });
    const headers = screen.getAllByRole('button');

    expect(headers[0]).toHaveTextContent('Header 1');
    expect(headers[1]).toHaveTextContent('Header 2');
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

    unmount();
  });

  test('expands on click without waitFor', async () => {
    const { unmount } = renderCollapse();

    expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

    unmount();
  });

  test('expands on click with waitFor', async () => {
    const { unmount } = renderCollapse();

    await waitFor(() => {
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => {
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    unmount();
  });

  // Update other tests similarly with waitFor
  test('collapses on click', async () => {
    const { unmount } = renderCollapse({ defaultActiveKey: ['1'] });

    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText('Content 1').parentNode).toHaveClass(
      'ant-collapse-content-hidden',
    );
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

    unmount();
  });
});
