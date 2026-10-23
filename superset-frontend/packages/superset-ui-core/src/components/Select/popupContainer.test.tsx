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
import { ConfigProvider } from 'antd';
import { render, userEvent, screen, waitFor } from '@superset-ui/core/spec';
import { AsyncSelect, Select } from '.';

const ARIA_LABEL = 'Test';
const options = [
  { label: 'One', value: 1 },
  { label: 'Two', value: 2 },
];
const loadOptions = async () => ({
  data: options,
  totalCount: options.length,
});

const components = [
  ['Select', () => <Select ariaLabel={ARIA_LABEL} options={options} />],
  [
    'AsyncSelect',
    () => <AsyncSelect ariaLabel={ARIA_LABEL} options={loadOptions} />,
  ],
] as const;

const openAndGetPopup = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: ARIA_LABEL }));
  await waitFor(() =>
    expect(document.querySelector('.ant-select-dropdown')).toBeInTheDocument(),
  );
  return document.querySelector('.ant-select-dropdown') as HTMLElement;
};

test.each(components)(
  '%s portals its popup to document.body inside a non-modal wrapper',
  async (_name, renderSelect) => {
    render(
      <div data-test="scroll-wrapper" style={{ overflow: 'auto' }}>
        {renderSelect()}
      </div>,
    );
    const popup = await openAndGetPopup();
    expect(screen.getByTestId('scroll-wrapper').contains(popup)).toBe(false);
    expect(popup.closest('.ant-select-dropdown')).toBe(popup);
    expect(popup.parentElement?.parentElement).toBe(document.body);
  },
);

test.each(components)(
  '%s defers to the ConfigProvider popup container when none is passed',
  async (_name, renderSelect) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      <ConfigProvider getPopupContainer={() => container}>
        {renderSelect()}
      </ConfigProvider>,
    );
    const popup = await openAndGetPopup();
    expect(container.contains(popup)).toBe(true);
    container.remove();
  },
);
