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
/// <reference types="@emotion/jest" />
import { RefObject } from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { Indicator } from 'src/dashboard/components/nativeFilters/selectors';
import DetailsPanel from '.';

const mockTriggerFocus = jest.fn();

const mockPopoverTriggerRef = {
  current: {
    focus: mockTriggerFocus,
  },
} as unknown as RefObject<HTMLButtonElement>;

const createProps = () => ({
  popoverVisible: true,
  popoverTriggerRef: mockPopoverTriggerRef,
  setPopoverVisible: jest.fn(),
  appliedCrossFilterIndicators: [
    {
      column: 'clinical_stage',
      name: 'Clinical Stage',
      value: [],
      status: 'UNSET',
      path: [
        'ROOT_ID',
        'TABS-wUKya7eQ0Z',
        'TAB-BCIJF4NvgQ',
        'ROW-xSeNAspgw',
        'CHART-eirDduqb1A',
      ],
    },
  ] as Indicator[],
  appliedIndicators: [
    {
      column: 'Country_name',
      name: 'Country',
      value: [],
      status: 'UNSET',
      path: [
        'ROOT_ID',
        'TABS-wUKya7eQ0Z',
        'TAB-BCIJF4NvgQ',
        'ROW-xSeNAspgw',
        'CHART-eirDduqb1A',
      ],
    },
  ] as Indicator[],
  incompatibleIndicators: [
    {
      column: 'product_category_copy',
      name: 'Vaccine Approach Copy',
      value: [],
      status: 'UNSET',
      path: [
        'ROOT_ID',
        'TABS-wUKya7eQ0Zz',
        'TAB-BCIJF4NvgQq',
        'ROW-xSeNAspgww',
        'CHART-eirDduqb1Aa',
      ],
    },
  ] as Indicator[],
  unsetIndicators: [
    {
      column: 'product_category',
      name: 'Vaccine Approach',
      value: [],
      status: 'UNSET',
      path: [
        'ROOT_ID',
        'TABS-wUKya7eQ0Z',
        'TAB-BCIJF4NvgQ',
        'ROW-xSeNAspgw',
        'CHART-eirDduqb1A',
      ],
    },
  ] as Indicator[],
  onHighlightFilterSource: jest.fn(),
});

test('Should render "appliedCrossFilterIndicators"', async () => {
  const props = createProps();
  props.appliedIndicators = [];
  props.incompatibleIndicators = [];
  props.unsetIndicators = [];

  render(
    <DetailsPanel {...props}>
      <div data-test="details-panel-content">Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  await userEvent.hover(screen.getByTestId('details-panel-content'));
  expect(
    await screen.findByText('Applied cross-filters (1)'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'search Clinical Stage' }),
  ).toBeInTheDocument();

  expect(props.onHighlightFilterSource).toHaveBeenCalledTimes(0);
  await userEvent.click(
    screen.getByRole('button', { name: 'search Clinical Stage' }),
  );
  expect(props.onHighlightFilterSource).toHaveBeenCalledTimes(1);
  expect(props.onHighlightFilterSource).toHaveBeenCalledWith([
    'ROOT_ID',
    'TABS-wUKya7eQ0Z',
    'TAB-BCIJF4NvgQ',
    'ROW-xSeNAspgw',
    'CHART-eirDduqb1A',
    'LABEL-clinical_stage',
  ]);
});

test('shows a rejected dashboard column under Incompatible', async () => {
  const props = createProps();
  props.appliedIndicators = [];
  props.appliedCrossFilterIndicators = [];
  render(
    <DetailsPanel {...props}>
      <button type="button">Filter status</button>
    </DetailsPanel>,
    { useRedux: true },
  );
  await userEvent.hover(screen.getByRole('button', { name: 'Filter status' }));
  expect(
    await screen.findByText('Incompatible filters (1)'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'search Vaccine Approach Copy' }),
  ).toBeInTheDocument();
});

test('Should render "appliedIndicators"', async () => {
  const props = createProps();
  props.appliedCrossFilterIndicators = [];
  props.incompatibleIndicators = [];
  props.unsetIndicators = [];

  render(
    <DetailsPanel {...props}>
      <div data-test="details-panel-content">Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  await userEvent.hover(screen.getByTestId('details-panel-content'));
  expect(await screen.findByText('Applied filters (1)')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'search Country' }),
  ).toBeInTheDocument();

  expect(props.onHighlightFilterSource).toHaveBeenCalledTimes(0);
  await userEvent.click(screen.getByRole('button', { name: 'search Country' }));
  expect(props.onHighlightFilterSource).toHaveBeenCalledTimes(1);
  expect(props.onHighlightFilterSource).toHaveBeenCalledWith([
    'ROOT_ID',
    'TABS-wUKya7eQ0Z',
    'TAB-BCIJF4NvgQ',
    'ROW-xSeNAspgw',
    'CHART-eirDduqb1A',
    'LABEL-Country_name',
  ]);
});

test('Should render empty', async () => {
  const props = createProps();
  props.appliedCrossFilterIndicators = [];
  props.appliedIndicators = [];
  props.incompatibleIndicators = [];
  props.unsetIndicators = [];

  render(
    <DetailsPanel {...props}>
      <div data-test="details-panel-content">Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  expect(screen.getByTestId('details-panel-content')).toBeInTheDocument();
  await userEvent.click(screen.getByTestId('details-panel-content'));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('Close popover with ESC or ENTER', async () => {
  const props = createProps();
  render(
    <DetailsPanel {...props}>
      <div>Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  const activeElement = document.activeElement as Element;

  // Close popover with Escape key
  fireEvent.keyDown(activeElement, { key: 'Escape', code: 'Escape' });
  expect(props.setPopoverVisible).toHaveBeenCalledWith(false);

  // Open the popover for this test
  props.popoverVisible = true;

  // Close with Enter
  fireEvent.keyDown(activeElement, { key: 'Enter', code: 'Enter' });
  expect(props.setPopoverVisible).toHaveBeenCalledWith(false);
});

test('Arrow key navigation switches focus between indicators', async () => {
  // Prepare props with two indicators
  const props = createProps();

  props.appliedCrossFilterIndicators = [
    {
      column: 'clinical_stage',
      name: 'Clinical Stage',
      value: [],
      path: ['PATH_TO_CLINICAL_STAGE'],
    },
    {
      column: 'age_group',
      name: 'Age Group',
      value: [],
      path: ['PATH_TO_AGE_GROUP'],
    },
  ];

  render(
    <DetailsPanel {...props}>
      <div>Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  // jsdom has no layout, so rc-menu's visibility check would skip every item
  // when moving focus.
  const offsetParentSpy = jest
    .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
    .mockReturnValue(document.body);

  // Query the indicators
  const firstMenuItem = screen.queryByText('Clinical Stage')?.closest('li')!;
  const secondMenuItem = screen.queryByText('Age Group')?.closest('li')!;

  expect(firstMenuItem).toBeInTheDocument();
  expect(secondMenuItem).toBeInTheDocument();

  firstMenuItem.focus();
  expect(firstMenuItem).toHaveFocus();

  // ArrowDown should move focus from the first indicator to the next one
  fireEvent.keyDown(firstMenuItem, {
    key: 'ArrowDown',
    code: 'ArrowDown',
    keyCode: 40,
    which: 40,
  });
  await waitFor(() => expect(secondMenuItem).toHaveFocus());

  // ArrowUp should move focus back to the previous indicator
  fireEvent.keyDown(secondMenuItem, {
    key: 'ArrowUp',
    code: 'ArrowUp',
    keyCode: 38,
    which: 38,
  });
  await waitFor(() => expect(firstMenuItem).toHaveFocus());

  offsetParentSpy.mockRestore();
});

const createKeyboardProps = () => {
  const props = createProps();
  props.appliedCrossFilterIndicators = [
    {
      column: 'clinical_stage',
      name: 'Clinical Stage',
      value: [],
      path: ['PATH_TO_CLINICAL_STAGE'],
    },
  ];
  props.appliedIndicators = [];
  props.onHighlightFilterSource = jest.fn();
  mockTriggerFocus.mockClear();
  return props;
};

test('Moves focus into the menu when the popover opens', async () => {
  const offsetParentSpy = jest
    .spyOn(HTMLElement.prototype, 'offsetParent', 'get')
    .mockReturnValue(document.body);
  const props = createKeyboardProps();

  render(
    <DetailsPanel {...props}>
      <div>Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  const menuItem = screen.getByText('Clinical Stage').closest('li')!;
  await waitFor(() => expect(menuItem).toHaveFocus());

  offsetParentSpy.mockRestore();
});

test('Enter on a focused menu item highlights its filter and closes the popover', async () => {
  const props = createKeyboardProps();

  render(
    <DetailsPanel {...props}>
      <div>Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  const menuItem = screen.getByText('Clinical Stage').closest('li')!;
  menuItem.focus();
  fireEvent.keyDown(menuItem, {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
  });

  expect(props.onHighlightFilterSource).toHaveBeenCalledTimes(1);
  expect(props.onHighlightFilterSource).toHaveBeenCalledWith([
    'PATH_TO_CLINICAL_STAGE',
    'LABEL-clinical_stage',
  ]);
  expect(mockTriggerFocus).toHaveBeenCalled();
  expect(props.setPopoverVisible).toHaveBeenLastCalledWith(false);
});

test('Clicking a menu item highlights its filter once and closes the popover', async () => {
  const props = createKeyboardProps();

  render(
    <DetailsPanel {...props}>
      <div>Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  await userEvent.click(screen.getByText('Clinical Stage'));

  expect(props.onHighlightFilterSource).toHaveBeenCalledTimes(1);
  expect(props.onHighlightFilterSource).toHaveBeenCalledWith([
    'PATH_TO_CLINICAL_STAGE',
    'LABEL-clinical_stage',
  ]);
  expect(mockTriggerFocus).toHaveBeenCalled();
  expect(props.setPopoverVisible).toHaveBeenLastCalledWith(false);
});

test('Escape in the menu returns focus to the trigger and closes the popover', async () => {
  const props = createKeyboardProps();

  render(
    <DetailsPanel {...props}>
      <div>Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  const menuItem = screen.getByText('Clinical Stage').closest('li')!;
  menuItem.focus();
  fireEvent.keyDown(menuItem, {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
  });

  expect(mockTriggerFocus).toHaveBeenCalled();
  expect(props.setPopoverVisible).toHaveBeenLastCalledWith(false);
  expect(props.onHighlightFilterSource).not.toHaveBeenCalled();
});
