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

const multiSelects = [
  [
    'Select',
    (extra: Record<string, unknown> = {}) => (
      <Select
        ariaLabel={ARIA_LABEL}
        options={options}
        mode="multiple"
        {...extra}
      />
    ),
  ],
  [
    'AsyncSelect',
    (extra: Record<string, unknown> = {}) => (
      <AsyncSelect
        ariaLabel={ARIA_LABEL}
        options={loadOptions}
        mode="multiple"
        {...extra}
      />
    ),
  ],
] as const;

const clickDone = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Done' }));
  await waitFor(() => expect(isPopupOpen()).toBe(false));
};

test.each(multiSelects)(
  '%s "Done" reports the close through onOpenChange',
  async (_name, renderSelect) => {
    const onOpenChange = jest.fn();
    render(renderSelect({ onOpenChange }));
    await openPopup();
    await clickDone();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  },
);

test.each(multiSelects)(
  '%s reopens on click after "Done"',
  async (_name, renderSelect) => {
    render(renderSelect());
    await openPopup();
    await clickDone();
    await userEvent.click(screen.getByRole('combobox', { name: ARIA_LABEL }));
    await waitFor(() => expect(isPopupOpen()).toBe(true));
  },
);

test.each(multiSelects)(
  '%s reopens on typing after "Done"',
  async (_name, renderSelect) => {
    render(renderSelect());
    await openPopup();
    await clickDone();
    await userEvent.type(
      screen.getByRole('combobox', { name: ARIA_LABEL }),
      'T',
    );
    await waitFor(() => expect(isPopupOpen()).toBe(true));
  },
);

test.each(multiSelects)(
  '%s closes when disabled while open and stays closed when re-enabled',
  async (_name, renderSelect) => {
    const onOpenChange = jest.fn();
    const { rerender } = render(renderSelect({ onOpenChange }));
    await openPopup();
    rerender(renderSelect({ onOpenChange, disabled: true }));
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false));
    rerender(renderSelect({ onOpenChange }));
    await waitFor(() => expect(isPopupOpen()).toBe(false));
  },
);

const rect = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;

// jsdom has no layout, and antd re-aligns the popup against the (zero-size)
// viewport, so placement is covered at the helper level below and was
// checked in a real browser.
const buildModal = (
  modalTop: number,
  triggerTop: number,
  footerTop: number,
) => {
  const modal = document.createElement('div');
  modal.className = 'ant-modal-container';
  modal.innerHTML =
    '<div class="wrap"><div class="ant-select"></div></div><div class="ant-modal-footer"></div>';
  const container = modal.querySelector('.wrap') as HTMLElement;
  const trigger = modal.querySelector('.ant-select') as HTMLElement;
  const footer = modal.querySelector('.ant-modal-footer') as HTMLElement;
  modal.getBoundingClientRect = () => rect(modalTop, footerTop + 60);
  trigger.getBoundingClientRect = () => rect(triggerTop, triggerTop + 32);
  footer.getBoundingClientRect = () => rect(footerTop, footerTop + 60);
  return container;
};

test('getPopupPlacement opens upward when the popup would cover the modal footer', () => {
  expect(getPopupPlacement(buildModal(0, 400, 480), 3)).toBe('topLeft');
});

test('getPopupPlacement mirrors the upward placement for RTL', () => {
  expect(getPopupPlacement(buildModal(0, 400, 480), 3, 'rtl')).toBe('topRight');
});

test('getPopupPlacement keeps the default when the popup fits above the footer', () => {
  // 3 options need ~144px; 400px of room below the trigger.
  expect(getPopupPlacement(buildModal(0, 48, 480), 3)).toBeUndefined();
});

test('getPopupPlacement keeps the default when the modal has less room above', () => {
  // Plenty of viewport above, but the trigger sits near the modal's top.
  expect(getPopupPlacement(buildModal(380, 400, 480), 3)).toBeUndefined();
});

test('getPopupPlacement keeps the default outside a modal', () => {
  const container = document.createElement('div');
  container.innerHTML = '<div class="ant-select"></div>';
  expect(getPopupPlacement(container, 3)).toBeUndefined();
});
