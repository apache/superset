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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import configureMockStore from 'redux-mock-store';
import { AdvancedFrame, CustomFrame } from '../components';

test.each([
  ['Advanced', AdvancedFrame],
  ['Custom', CustomFrame],
] as const)('%s shares row validation styling', async (_, Frame) => {
  const props = {
    onChange: jest.fn(),
    value: '2025-01-01T00:00:00 : 2025-05-31T00:00:00',
    limits: {
      startId: 'start',
      endId: 'end',
      rowInvalid: true,
      pending: false,
    },
  };
  const { rerender } = render(<Frame {...props} />, {
    store: configureMockStore([])({ common: { locale: 'en' } }),
  });
  const inputs = await screen.findAllByRole('textbox');
  inputs.forEach(input => {
    expect(input.closest('.ant-form-item')).toHaveClass(
      'ant-form-item-has-error',
    );
    expect(input.closest('[class*="status-error"]')).not.toBeNull();
  });

  rerender(<Frame {...props} limits={{ ...props.limits, pending: true }} />);
  await waitFor(() =>
    inputs.forEach(input => {
      expect(input.closest('.ant-form-item')).not.toHaveClass(
        'ant-form-item-has-error',
      );
      expect(input.closest('[class*="status-error"]')).toBeNull();
    }),
  );

  rerender(
    <Frame {...props} limits={{ ...props.limits, rowInvalid: false }} />,
  );
  inputs.forEach(input => {
    expect(input.closest('.ant-form-item')).not.toHaveClass(
      'ant-form-item-has-error',
    );
    expect(input.closest('[class*="status-error"]')).toBeNull();
  });
});
