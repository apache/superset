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
import { BrowserRouter } from 'react-router-dom';
import { supersetTheme } from '@apache-superset/core/theme';
import { Button, Dropdown } from '@superset-ui/core/components';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import SubMenu, { ButtonProps } from './SubMenu';

const mockedProps = {
  name: 'Title',
  tabs: [
    {
      name: 'Page1',
      label: 'Page1',
      url: '/page1',
      usesRouter: true,
    },
    {
      name: 'Page2',
      label: 'Page2',
      url: '/page2',
      usesRouter: true,
    },
    {
      name: 'Page3',
      label: 'Page3',
      url: '/page3',
      usesRouter: false,
    },
  ],
  dropDownLinks: [
    {
      label: 'test an upload',
      childs: [
        {
          label: 'Upload Test',
          name: 'Upload Test',
          url: '/test/form',
          perm: true,
        },
      ],
    },
  ],
};

const setup = (overrides: Record<string, any> = {}) => {
  const props = {
    ...mockedProps,
    ...overrides,
  };
  return render(
    <BrowserRouter>
      <SubMenu {...props} />
    </BrowserRouter>,
  );
};

test('should render', async () => {
  const { container } = setup();
  expect(await screen.findByText(/title/i)).toBeInTheDocument();
  expect(container).toBeInTheDocument();
});

test('should render the navigation', async () => {
  setup();
  expect(await screen.findByRole('navigation')).toBeInTheDocument();
});

test('should render the brand', async () => {
  setup();
  expect(await screen.findByText('Title')).toBeInTheDocument();
});

test('should render the right number of tabs', async () => {
  setup();
  expect(await screen.findAllByRole('tab')).toHaveLength(3);
});

test('should render all the tabs links', async () => {
  const { tabs } = mockedProps;
  setup();
  expect(await screen.findAllByRole('tab')).toHaveLength(3);
  tabs.forEach(tab => {
    const tabItem = screen.getByText(tab.label);
    expect(tabItem).toHaveAttribute('href', tab.url);
  });
});

test('should render dropdownlinks', async () => {
  setup();
  await userEvent.hover(screen.getByText('test an upload'));
  const label = await screen.findByText('test an upload');
  expect(label).toBeInTheDocument();
});

test('should render the buttons', async () => {
  const mockFunc = jest.fn();
  const buttons = [
    {
      name: 'test_button',
      onClick: mockFunc,
      buttonStyle: 'primary' as ButtonProps['buttonStyle'],
    },
    {
      name: 'danger_button',
      onClick: mockFunc,
      buttonStyle: 'danger' as ButtonProps['buttonStyle'],
    },
  ];
  setup({ buttons });
  const testButton = screen.getByText(buttons[0].name);
  expect(await screen.findAllByRole('button')).toHaveLength(2);
  await userEvent.click(testButton);
  expect(mockFunc).toHaveBeenCalled();
});

// Mobile support tests
test('should render leftIcon when provided', async () => {
  setup({
    leftIcon: (
      <button type="button" data-test="left-icon-button">
        Search
      </button>
    ),
  });
  expect(await screen.findByTestId('left-icon-button')).toBeInTheDocument();
});

test('should render rightIcon when provided', async () => {
  setup({
    rightIcon: (
      <button type="button" data-test="right-icon-button">
        Menu
      </button>
    ),
  });
  expect(await screen.findByTestId('right-icon-button')).toBeInTheDocument();
});

test('should render both leftIcon and rightIcon together', async () => {
  setup({
    leftIcon: <span data-test="mobile-left">Left</span>,
    rightIcon: <span data-test="mobile-right">Right</span>,
  });
  expect(await screen.findByTestId('mobile-left')).toBeInTheDocument();
  expect(await screen.findByTestId('mobile-right')).toBeInTheDocument();
});

// Button spaces adjacent `.superset-button` siblings with an emotion `css`
// rule (`& + .superset-button`). jsdom's getComputedStyle ignores selector
// specificity, so spacing is read from the matching stylesheet rules instead.
const HEADER_BUTTON_GAP = supersetTheme.sizeUnit * 2;

const declaredMarginLeft = (element: Element): number =>
  Math.max(
    0,
    ...Array.from(document.styleSheets)
      .flatMap(sheet => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && element.matches(rule.selectorText),
      )
      .map(rule => parseFloat(rule.style.getPropertyValue('margin-left')) || 0),
  );

// The header item containing `trigger`, i.e. the direct child of the button row.
const headerItem = (trigger: HTMLElement, row: Element): HTMLElement => {
  let item = trigger;
  while (item.parentElement && item.parentElement !== row) {
    item = item.parentElement;
  }
  return item;
};

// Space the browser puts before the header item containing `trigger`, which
// follows `previous`: a full gap when both are adjacent `.superset-button`
// siblings (Button's own rule), otherwise the item's declared left margin.
const gapBefore = (trigger: HTMLElement, previous: HTMLElement): number => {
  const item = headerItem(trigger, previous.parentElement!);
  return item.previousElementSibling === previous &&
    item.matches('.superset-button') &&
    previous.matches('.superset-button')
    ? HEADER_BUTTON_GAP
    : declaredMarginLeft(item);
};

const bulkSelectButton: ButtonProps = {
  name: 'Bulk select',
  buttonStyle: 'secondary',
  onClick: jest.fn(),
};

const newDropdownButton: ButtonProps = {
  name: 'New',
  buttonStyle: 'primary',
  component: (
    <Dropdown
      menu={{ items: [{ key: 'dataset', label: 'Dataset' }] }}
      trigger={['click']}
    >
      <Button data-test="btn-create-new" buttonStyle="primary">
        New
      </Button>
    </Dropdown>
  ),
};

test('separates adjacent plain header buttons', async () => {
  setup({
    buttons: [
      bulkSelectButton,
      { name: 'New', buttonStyle: 'primary', onClick: jest.fn() },
    ],
  });
  const previous = await screen.findByRole('button', { name: 'Bulk select' });
  const next = screen.getByRole('button', { name: 'New' });
  expect(gapBefore(next, previous)).toBe(HEADER_BUTTON_GAP);
});

test('separates a custom component button from the preceding button', async () => {
  setup({ buttons: [bulkSelectButton, newDropdownButton] });
  const previous = await screen.findByRole('button', { name: 'Bulk select' });
  const trigger = screen.getByTestId('btn-create-new');
  expect(gapBefore(trigger, previous)).toBe(HEADER_BUTTON_GAP);
});

test('separates a custom component button from the preceding button in the collapsed layout', async () => {
  const originalWidth = window.innerWidth;
  window.innerWidth = 700;
  try {
    const { container } = setup({
      buttons: [
        { name: 'Import', buttonStyle: 'link', onClick: jest.fn() },
        bulkSelectButton,
        newDropdownButton,
      ],
    });
    const previous = await screen.findByRole('button', {
      name: 'Bulk select',
    });
    expect(container.querySelector('.nav-right-collapse')).toBeInTheDocument();
    const trigger = screen.getByTestId('btn-create-new');
    expect(gapBefore(trigger, previous)).toBe(HEADER_BUTTON_GAP);
  } finally {
    window.innerWidth = originalWidth;
  }
});
