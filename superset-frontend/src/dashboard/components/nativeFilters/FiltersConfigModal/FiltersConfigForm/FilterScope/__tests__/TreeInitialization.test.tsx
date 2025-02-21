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
import { createMockModal } from './utils';

describe('FilterScope TreeInitialization', () => {
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

  it('correct init tree with values', async () => {
    const { MockModalComponent } = createMockModal({
      scope: {
        rootPath: ['TAB_ID'],
        excluded: [],
      },
      formRef,
    });

    const modal = render(<MockModalComponent />);

    const scopingTab = await screen.findByRole('tab', { name: 'Scoping' });
    fireEvent.click(scopingTab);

    jest.runAllTimers();

    await waitFor(
      () => {
        expect(screen.getByRole('tree')).toBeInTheDocument();
      },
      { timeout: 10000 },
    );

    jest.runAllTimers();

    await waitFor(
      () => {
        const checkedNodes = document.querySelectorAll(
          '.ant-tree-checkbox-checked',
        );
        expect(checkedNodes.length).toBe(1);
      },
      { timeout: 10000 },
    );

    modal.unmount();
  }, 30000);
});
