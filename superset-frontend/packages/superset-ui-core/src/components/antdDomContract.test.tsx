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

/**
 * antd DOM-class contract.
 *
 * Superset styles some antd internals by targeting their generated `.ant-*`
 * DOM classes (in `GlobalStyles.tsx`, `Select/styles.tsx`, Tooltip overrides,
 * etc.). When antd renames those classes across a major version, the overrides
 * silently stop matching — nothing throws, styling just quietly breaks. The
 * antd 5 -> 6 upgrade did exactly this (e.g. `.ant-select-selection-item` ->
 * `.ant-select-content`, `.ant-popover-inner` -> `.ant-popover-container`).
 *
 * These render antd directly (not the Superset wrappers) on purpose: they pin
 * the exact class names our CSS depends on, so a future antd bump that renames
 * one fails here with a clear pointer instead of shipping a visual regression.
 */
import { render } from '@superset-ui/core/spec';
// eslint-disable-next-line no-restricted-imports
import { Modal, Popover, Tabs, Tooltip } from 'antd';
import { Select } from './Select';

const antClasses = (root: ParentNode): string[] => {
  const classes = new Set<string>();
  root
    .querySelectorAll('*')
    .forEach(el =>
      el.classList.forEach(c => c.startsWith('ant-') && classes.add(c)),
    );
  return [...classes];
};

test('Select single-value container class (Select/styles.tsx targets it)', () => {
  const { container } = render(
    <Select
      ariaLabel="contract"
      value="a"
      options={[{ label: 'Alpha', value: 'a' }]}
    />,
  );
  expect(antClasses(container)).toEqual(
    expect.arrayContaining([
      'ant-select-content',
      'ant-select-content-has-value',
    ]),
  );
});

test('Select multiple overflow + placeholder classes (Select/styles.tsx, CronPicker)', () => {
  const { container: withTags } = render(
    <Select
      ariaLabel="contract-multi"
      mode="multiple"
      maxTagCount={1}
      value={['a', 'b']}
      options={[
        { label: 'Alpha', value: 'a' },
        { label: 'Beta', value: 'b' },
      ]}
    />,
  );
  expect(antClasses(withTags)).toEqual(
    expect.arrayContaining([
      'ant-select-content-item',
      'ant-select-content-item-rest',
      // multiple-mode tags keep the v5 class name
      'ant-select-selection-item',
    ]),
  );

  const { container: empty } = render(
    <Select ariaLabel="contract-empty" placeholder="pick" options={[]} />,
  );
  expect(antClasses(empty)).toContain('ant-select-placeholder');
});

test('Popover container class (GlobalStyles explore-popover override targets it)', () => {
  render(
    <Popover open title="t" content="c">
      <span>anchor</span>
    </Popover>,
  );
  expect(antClasses(document.body)).toContain('ant-popover-container');
});

test('Tooltip container class (ColumnElement/DateFunctionTooltip overrides target it)', () => {
  render(
    <Tooltip open title="tip">
      <span>anchor</span>
    </Tooltip>,
  );
  expect(antClasses(document.body)).toContain('ant-tooltip-container');
});

test('Tabs content DOM chain (SQL Lab / Explore fullHeight overrides target it)', () => {
  // antd 6 restructured the Tabs content DOM. The `fullHeight` height chain in
  // Tabs.tsx and many app overrides walk body-holder -> body -> content(panel);
  // if any level's class is stale, the chain collapses and heavy content (the
  // SQL Lab Ace editor) renders at 0 height. antd 5 -> 6 renamed:
  //   .ant-tabs-content-holder -> .ant-tabs-body-holder
  //   .ant-tabs-content (wrapper) -> .ant-tabs-body  (new intermediate level)
  //   .ant-tabs-tabpane (panel) -> .ant-tabs-content (now the [role=tabpanel])
  const { container } = render(
    <Tabs
      items={[
        {
          key: '1',
          label: 'One',
          children: <div className="ace_editor">editor</div>,
        },
      ]}
    />,
  );
  const classes = antClasses(container);
  expect(classes).toEqual(
    expect.arrayContaining([
      'ant-tabs-body-holder',
      'ant-tabs-body',
      'ant-tabs-content',
    ]),
  );
  // The [role=tabpanel] must be `.ant-tabs-content` (was `.ant-tabs-tabpane`),
  // and the removed class must not reappear.
  const panel = container.querySelector('[role="tabpanel"]');
  expect(panel).toHaveClass('ant-tabs-content');
  expect(classes).not.toContain('ant-tabs-tabpane');
});

test('Modal body class (many *.styles.ts modal overrides target it)', () => {
  render(
    <Modal open title="t">
      body
    </Modal>,
  );
  expect(antClasses(document.body)).toContain('ant-modal-body');
});
