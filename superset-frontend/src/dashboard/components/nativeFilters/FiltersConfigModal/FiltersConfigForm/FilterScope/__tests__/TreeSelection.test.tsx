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
  fireEvent,
  waitFor,
  cleanup,
} from 'spec/helpers/testing-library';
import { FormInstance } from 'antd/lib/form';
import { createMockModal, getTreeSwitcher } from './utils';

describe('FilterScope TreeSelection', () => {
  let formRef: { current: FormInstance | null };

  beforeEach(() => {
    jest.useFakeTimers();
    formRef = { current: null };
  });

  afterEach(() => {
    cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('select tree values with 1 excluded', async () => {
    const { MockModalComponent } = createMockModal({ formRef });
    const modal = render(<MockModalComponent />);

    const scopingTab = await screen.findByRole('tab', { name: 'Scoping' });
    fireEvent.click(scopingTab);

    await waitFor(
      () => {
        expect(screen.getByRole('tree')).toBeInTheDocument();
        expect(
          document.querySelector('.ant-tree-treenode'),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.click(getTreeSwitcher(2));

    const chartNode = await screen.findByText('CHART_ID2');
    fireEvent.click(chartNode);

    await waitFor(
      () => {
        expect(formRef.current).toBeTruthy();
        const scope = formRef.current?.getFieldValue([
          'filters',
          'DefaultFilterId',
          'scope',
        ]);
        expect(scope).toEqual({
          excluded: [20],
          rootPath: ['ROOT_ID'],
        });
      },
      { timeout: 3000 },
    );

    modal.unmount();
  });

  it('select 1 value only', async () => {
    const { MockModalComponent } = createMockModal({ formRef });
    const modal = render(<MockModalComponent />);

    const scopingTab = await screen.findByRole('tab', { name: 'Scoping' });
    fireEvent.click(scopingTab);

    await waitFor(
      () => {
        expect(screen.getByRole('tree')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.click(getTreeSwitcher(2));

    const chartNode = await screen.findByText('CHART_ID2');
    fireEvent.click(chartNode);

    const tabNode = await screen.findByText('tab1');
    fireEvent.click(tabNode);

    await waitFor(
      () => {
        expect(formRef.current).toBeTruthy();
        const scope = formRef.current?.getFieldValue([
          'filters',
          'DefaultFilterId',
          'scope',
        ]);
        expect(scope).toEqual({
          excluded: [18, 20],
          rootPath: ['ROOT_ID'],
        });
      },
      { timeout: 3000 },
    );

    modal.unmount();
  });
});
