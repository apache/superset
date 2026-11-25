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
import { render, userEvent, screen, waitFor } from '@superset-ui/core/spec';
import { AsyncSelect, Select } from '.';
import { getPopupPlacement } from './utils';

const ARIA_LABEL = 'Test';
const options = [
  { label: 'One', value: 1 },
  { label: 'Two', value: 2 },
  { label: 'Three', value: 3 },
];
const loadOptions = async () => ({
  data: options,
  totalCount: options.length,
});

const openPopup = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: ARIA_LABEL }));
  await waitFor(() =>
    expect(document.querySelector('.ant-select-dropdown')).toBeInTheDocument(),
  );
};

const isPopupOpen = () =>
  Boolean(
    document.querySelector(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    ),
  );

test.each([
  [
    'Select',
    () => <Select ariaLabel={ARIA_LABEL} options={options} mode="multiple" />,
  ],
  [
    'AsyncSelect',
    () => (
      <AsyncSelect
        ariaLabel={ARIA_LABEL}
        options={loadOptions}
        mode="multiple"
      />
    ),
  ],
] as const)(
  '%s multi-select "Done" closes the popup and keeps the selection',
  async (_name, renderSelect) => {
    render(renderSelect());
    await openPopup();
    await userEvent.click(await screen.findByText('One'));
    expect(isPopupOpen()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(isPopupOpen()).toBe(false));
    expect(
      document.querySelector('.ant-select-selection-item'),
    ).toHaveTextContent('One');
  },
);

test.each([
  ['Select', () => <Select ariaLabel={ARIA_LABEL} options={options} />],
  [
    'AsyncSelect',
    () => <AsyncSelect ariaLabel={ARIA_LABEL} options={loadOptions} />,
  ],
] as const)(
  '%s single-select has no "Done" action',
  async (_name, renderSelect) => {
    render(renderSelect());
    await openPopup();
    await screen.findByText('One');
    expect(
      screen.queryByRole('button', { name: 'Done' }),
    ).not.toBeInTheDocument();
  },
);

test('typing reopens the popup after "Done"', async () => {
  render(<Select ariaLabel={ARIA_LABEL} options={options} mode="multiple" />);
  await openPopup();
  await userEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(isPopupOpen()).toBe(false));

  await userEvent.type(screen.getByRole('combobox', { name: ARIA_LABEL }), 'T');

  await waitFor(() => expect(isPopupOpen()).toBe(true));
});

test('disabling an open select closes it and it stays closed when re-enabled', async () => {
  const onOpenChange = jest.fn();
  const { rerender } = render(
    <Select
      ariaLabel={ARIA_LABEL}
      options={options}
      mode="multiple"
      onOpenChange={onOpenChange}
    />,
  );
  await openPopup();
  rerender(
    <Select
      ariaLabel={ARIA_LABEL}
      options={options}
      mode="multiple"
      onOpenChange={onOpenChange}
      disabled
    />,
  );
  await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
  rerender(
    <Select
      ariaLabel={ARIA_LABEL}
      options={options}
      mode="multiple"
      onOpenChange={onOpenChange}
    />,
  );
  await waitFor(() => expect(isPopupOpen()).toBe(false));
});

const rect = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;

const buildModal = (
  modalTop: number,
  triggerTop: number,
  footerTop: number,
) => {
  const modal = document.createElement('div');
  modal.className = 'ant-modal-container';
  modal.innerHTML =
    '<div class="trigger"></div><div class="ant-modal-footer"></div>';
  const trigger = modal.querySelector('.trigger') as HTMLElement;
  const footer = modal.querySelector('.ant-modal-footer') as HTMLElement;
  modal.getBoundingClientRect = () => rect(modalTop, footerTop + 60);
  trigger.getBoundingClientRect = () => rect(triggerTop, triggerTop + 32);
  footer.getBoundingClientRect = () => rect(footerTop, footerTop + 60);
  return trigger;
};

test('getPopupPlacement opens upward when the popup would cover the modal footer', () => {
  expect(getPopupPlacement(buildModal(0, 400, 480), 200)).toBe('topLeft');
});

test('getPopupPlacement mirrors the upward placement for RTL', () => {
  expect(getPopupPlacement(buildModal(0, 400, 480), 200, 'rtl')).toBe(
    'topRight',
  );
});

test('getPopupPlacement keeps the default when there is room above the footer', () => {
  expect(getPopupPlacement(buildModal(0, 100, 480), 200)).toBeUndefined();
});

test('getPopupPlacement keeps the default when the modal has less room above', () => {
  // Plenty of viewport above, but the trigger sits near the modal's top.
  expect(getPopupPlacement(buildModal(380, 400, 480), 200)).toBeUndefined();
});

test('getPopupPlacement keeps the default outside a modal', () => {
  const trigger = document.createElement('div');
  expect(getPopupPlacement(trigger, 200)).toBeUndefined();
});
