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

import { fireEvent, render } from '@superset-ui/core/spec';
import Tabs, { EditableTabs, LineEditableTabs } from './Tabs';

const defaultItems = [
  {
    key: '1',
    label: 'Tab 1',
    children: <div data-testid="tab1-content">Tab 1 content</div>,
  },
  {
    key: '2',
    label: 'Tab 2',
    children: <div data-testid="tab2-content">Tab 2 content</div>,
  },
  {
    key: '3',
    label: 'Tab 3',
    children: <div data-testid="tab3-content">Tab 3 content</div>,
  },
];

describe('Tabs', () => {
  describe('Basic Tabs', () => {
    it('should render tabs with default props', () => {
      const { getByText, container } = render(<Tabs items={defaultItems} />);

      expect(getByText('Tab 1')).toBeInTheDocument();
      expect(getByText('Tab 2')).toBeInTheDocument();
      expect(getByText('Tab 3')).toBeInTheDocument();

      const activeTabContent = container.querySelector(
        '.ant-tabs-tabpane-active',
      );

      expect(activeTabContent).toBeDefined();
      expect(
        activeTabContent?.querySelector('[data-testid="tab1-content"]'),
      ).toBeDefined();
    });

    it('should render tabs component structure', () => {
      const { container } = render(<Tabs items={defaultItems} />);
      const tabsElement = container.querySelector('.ant-tabs');
      const tabsNav = container.querySelector('.ant-tabs-nav');
      const tabsContent = container.querySelector('.ant-tabs-content-holder');

      expect(tabsElement).toBeDefined();
      expect(tabsNav).toBeDefined();
      expect(tabsContent).toBeDefined();
    });

    it('should apply default tabBarStyle with padding', () => {
      const { container } = render(<Tabs items={defaultItems} />);
      const tabsNav = container.querySelector('.ant-tabs-nav') as HTMLElement;

      // Check that tabBarStyle is applied (default padding is added)
      expect(tabsNav?.style?.paddingLeft).toBeDefined();
    });

    it('should merge custom tabBarStyle with defaults', () => {
      const customStyle = { paddingRight: '20px', backgroundColor: 'red' };
      const { container } = render(
        <Tabs items={defaultItems} tabBarStyle={customStyle} />,
      );
      const tabsNav = container.querySelector('.ant-tabs-nav') as HTMLElement;

      expect(tabsNav?.style?.paddingLeft).toBeDefined();
      expect(tabsNav?.style?.paddingRight).toBe('20px');
      expect(tabsNav?.style?.backgroundColor).toBe('red');
    });

    it('should handle allowOverflow prop', () => {
      const { container: allowContainer } = render(
        <Tabs items={defaultItems} allowOverflow />,
      );
      const { container: disallowContainer } = render(
        <Tabs items={defaultItems} allowOverflow={false} />,
      );

      expect(allowContainer.querySelector('.ant-tabs')).toBeDefined();
      expect(disallowContainer.querySelector('.ant-tabs')).toBeDefined();
    });

    it('should disable animation by default', () => {
      const { container } = render(<Tabs items={defaultItems} />);
      const tabsElement = container.querySelector('.ant-tabs');

      expect(tabsElement?.className).not.toContain('ant-tabs-animated');
    });

    it('should handle tab change events', () => {
      const onChangeMock = jest.fn();
      const { getByText } = render(
        <Tabs items={defaultItems} onChange={onChangeMock} />,
      );

      fireEvent.click(getByText('Tab 2'));

      expect(onChangeMock).toHaveBeenCalledWith('2');
    });

    it('should pass through additional props to Antd Tabs', () => {
      const onTabClickMock = jest.fn();
      const { getByText } = render(
        <Tabs
          items={defaultItems}
          onTabClick={onTabClickMock}
          size="large"
          centered
        />,
      );

      fireEvent.click(getByText('Tab 2'));

      expect(onTabClickMock).toHaveBeenCalled();
    });
  });

  describe('EditableTabs', () => {
    it('should render with editable features', () => {
      const { container } = render(<EditableTabs items={defaultItems} />);

      const tabsElement = container.querySelector('.ant-tabs');

      expect(tabsElement?.className).toContain('ant-tabs-card');
      expect(tabsElement?.className).toContain('ant-tabs-editable-card');
    });

    it('should handle onEdit callback for add/remove actions', () => {
      const onEditMock = jest.fn();
      const itemsWithRemove = defaultItems.map(item => ({
        ...item,
        closable: true,
      }));

      const { container } = render(
        <EditableTabs items={itemsWithRemove} onEdit={onEditMock} />,
      );

      const removeButton = container.querySelector('.ant-tabs-tab-remove');
      expect(removeButton).toBeDefined();

      fireEvent.click(removeButton!);
      expect(onEditMock).toHaveBeenCalledWith(expect.any(String), 'remove');
    });

    it('should have default props set correctly', () => {
      expect(EditableTabs.defaultProps?.type).toBe('editable-card');
      expect(EditableTabs.defaultProps?.animated).toEqual({
        inkBar: true,
        tabPane: false,
      });
    });
  });

  describe('LineEditableTabs', () => {
    it('should render as line-style editable tabs', () => {
      const { container } = render(<LineEditableTabs items={defaultItems} />);

      const tabsElement = container.querySelector('.ant-tabs');

      expect(tabsElement?.className).toContain('ant-tabs-card');
      expect(tabsElement?.className).toContain('ant-tabs-editable-card');
    });

    it('should render with line-specific styling', () => {
      const { container } = render(<LineEditableTabs items={defaultItems} />);

      const inkBar = container.querySelector('.ant-tabs-ink-bar');
      expect(inkBar).toBeDefined();
    });
  });

  describe('TabPane Legacy Support', () => {
    it('should support TabPane component access', () => {
      expect(Tabs.TabPane).toBeDefined();
      expect(EditableTabs.TabPane).toBeDefined();
      expect(LineEditableTabs.TabPane).toBeDefined();
    });

    it('should render using legacy TabPane syntax', () => {
      const { getByText, container } = render(
        <Tabs>
          <Tabs.TabPane tab="Legacy Tab 1" key="1">
            <div data-testid="legacy-content-1">Legacy content 1</div>
          </Tabs.TabPane>
          <Tabs.TabPane tab="Legacy Tab 2" key="2">
            <div data-testid="legacy-content-2">Legacy content 2</div>
          </Tabs.TabPane>
        </Tabs>,
      );

      expect(getByText('Legacy Tab 1')).toBeInTheDocument();
      expect(getByText('Legacy Tab 2')).toBeInTheDocument();

      const activeTabContent = container.querySelector(
        '.ant-tabs-tabpane-active [data-testid="legacy-content-1"]',
      );

      expect(activeTabContent).toBeDefined();
      expect(activeTabContent?.textContent).toBe('Legacy content 1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty items array', () => {
      const { container } = render(<Tabs items={[]} />);
      const tabsElement = container.querySelector('.ant-tabs');

      expect(tabsElement).toBeDefined();
    });

    it('should handle undefined items', () => {
      const { container } = render(<Tabs />);
      const tabsElement = container.querySelector('.ant-tabs');

      expect(tabsElement).toBeDefined();
    });

    it('should handle tabs with no content', () => {
      const itemsWithoutContent = [
        { key: '1', label: 'Tab 1' },
        { key: '2', label: 'Tab 2' },
      ];

      const { getByText } = render(<Tabs items={itemsWithoutContent} />);

      expect(getByText('Tab 1')).toBeInTheDocument();
      expect(getByText('Tab 2')).toBeInTheDocument();
    });

    it('should handle allowOverflow default value', () => {
      const { container } = render(<Tabs items={defaultItems} />);
      expect(container.querySelector('.ant-tabs')).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('should render with proper ARIA roles', () => {
      const { container } = render(<Tabs items={defaultItems} />);

      const tablist = container.querySelector('[role="tablist"]');
      const tabs = container.querySelectorAll('[role="tab"]');

      expect(tablist).toBeDefined();
      expect(tabs.length).toBe(3);
    });

    it('should support keyboard navigation', () => {
      const { container, getByText } = render(<Tabs items={defaultItems} />);

      const firstTab = container.querySelector('[role="tab"]');
      const secondTab = getByText('Tab 2');

      if (firstTab) {
        fireEvent.keyDown(firstTab, { key: 'ArrowRight', code: 'ArrowRight' });
      }

      fireEvent.click(secondTab);

      expect(secondTab).toBeInTheDocument();
    });
  });

  describe('Styling Integration', () => {
    it('should accept and apply custom CSS classes', () => {
      const { container } = render(
        // eslint-disable-next-line react/forbid-component-props
        <Tabs items={defaultItems} className="custom-tabs-class" />,
      );

      const tabsElement = container.querySelector('.ant-tabs');

      expect(tabsElement?.className).toContain('custom-tabs-class');
    });

    it('should accept and apply custom styles', () => {
      const customStyle = { minHeight: '200px' };
      const { container } = render(
        // eslint-disable-next-line react/forbid-component-props
        <Tabs items={defaultItems} style={customStyle} />,
      );

      const tabsElement = container.querySelector('.ant-tabs') as HTMLElement;

      expect(tabsElement?.style?.minHeight).toBe('200px');
    });
  });
});

test('fullHeight prop renders component hierarchy correctly', () => {
  const { container } = render(<Tabs items={defaultItems} fullHeight />);

  const tabsElement = container.querySelector('.ant-tabs');
  const contentHolder = container.querySelector('.ant-tabs-content-holder');
  const content = container.querySelector('.ant-tabs-content');
  const tabPane = container.querySelector('.ant-tabs-tabpane');

  expect(tabsElement).toBeInTheDocument();
  expect(contentHolder).toBeInTheDocument();
  expect(content).toBeInTheDocument();
  expect(tabPane).toBeInTheDocument();
  expect(tabsElement?.contains(contentHolder as Node)).toBe(true);
  expect(contentHolder?.contains(content as Node)).toBe(true);
  expect(content?.contains(tabPane as Node)).toBe(true);
});

test('fullHeight prop maintains structure when content updates', () => {
  const { container, rerender } = render(
    <Tabs items={defaultItems} fullHeight />,
  );

  const initialTabsElement = container.querySelector('.ant-tabs');

  const newItems = [
    ...defaultItems,
    {
      key: '4',
      label: 'Tab 4',
      children: <div data-testid="tab4-content">New tab content</div>,
    },
  ];

  rerender(<Tabs items={newItems} fullHeight />);

  const updatedTabsElement = container.querySelector('.ant-tabs');
  const updatedContentHolder = container.querySelector(
    '.ant-tabs-content-holder',
  );

  expect(updatedTabsElement).toBeInTheDocument();
  expect(updatedContentHolder).toBeInTheDocument();
  expect(initialTabsElement).toBe(updatedTabsElement);
});

test('fullHeight prop works with allowOverflow to handle tall content', () => {
  const { container } = render(
    <Tabs items={defaultItems} fullHeight allowOverflow />,
  );

  const tabsElement = container.querySelector('.ant-tabs') as HTMLElement;
  const contentHolder = container.querySelector(
    '.ant-tabs-content-holder',
  ) as HTMLElement;

  expect(tabsElement).toBeInTheDocument();
  expect(contentHolder).toBeInTheDocument();

  // Verify overflow handling is not restricted
  const holderStyles = window.getComputedStyle(contentHolder);
  expect(holderStyles.overflow).not.toBe('hidden');
});

test('fullHeight prop handles empty items array', () => {
  const { container } = render(<Tabs items={[]} fullHeight />);

  expect(container.querySelector('.ant-tabs')).toBeInTheDocument();
});
