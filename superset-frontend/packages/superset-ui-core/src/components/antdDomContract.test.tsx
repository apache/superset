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
import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import {
  // eslint-disable-next-line no-restricted-imports
  Alert,
  Collapse,
  Modal,
  Popover,
  Progress,
  Spin,
  Steps,
  Tabs,
  Tag,
  Tooltip,
} from 'antd';
import { Modal as SupersetModal } from './Modal';
import { AsyncSelect, Select } from './Select';

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
      // the search <input>; Select/styles.tsx and the E2E helpers target it
      'ant-select-input',
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
      // the search-input overflow item; Select/styles.tsx oneLine targets it
      'ant-select-content-item-suffix',
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
  const classes = antClasses(document.body);
  expect(classes).toEqual(
    expect.arrayContaining([
      'ant-popover-container',
      // body element (was .ant-popover-inner-content in v5); Cypress helpers
      // and DropdownContainer/ag-grid overrides depend on these
      'ant-popover-content',
      'ant-popover-title',
    ]),
  );
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
      // active-panel modifier; DatasourceEditor's height override targets it
      'ant-tabs-content-active',
    ]),
  );
  // The [role=tabpanel] must be `.ant-tabs-content` (was `.ant-tabs-tabpane`),
  // and the removed class must not reappear.
  const panel = container.querySelector('[role="tabpanel"]');
  expect(panel).toHaveClass('ant-tabs-content');
  expect(classes).not.toContain('ant-tabs-tabpane');
});

test('Steps classes (QueryStatusBar, ChartCreation, SQL Lab loading detection)', () => {
  // `.ant-steps` is what executeQuery()/waitForQueryResults() watch to detect the
  // SQL Lab loading cycle, and QueryStatusBar/ChartCreation style the item parts.
  // antd 6 renamed the connector line `.ant-steps-item-tail` -> `.ant-steps-item-rail`
  // (ChartCreation hides it), while `-item-icon`/`-item-title`/`-item-content` survive.
  const { container } = render(
    <Steps
      current={0}
      items={[{ title: 'A', description: 'd' }, { title: 'B' }]}
    />,
  );
  const classes = antClasses(container);
  expect(classes).toEqual(
    expect.arrayContaining([
      'ant-steps',
      'ant-steps-item',
      'ant-steps-item-icon',
      'ant-steps-item-title',
      'ant-steps-item-rail',
      'ant-steps-item-content',
    ]),
  );
  expect(classes).not.toContain('ant-steps-item-tail');
  // antd 6 removed the nested `.ant-steps-item-description`; the description text
  // now renders directly inside `.ant-steps-item-content`. ChartCreation styles
  // the description by targeting `.ant-steps-item-content` for exactly this reason.
  expect(classes).not.toContain('ant-steps-item-description');
  expect(container.querySelector('.ant-steps-item-content')).toHaveTextContent(
    'd',
  );
});

test('Select suffix (arrow) class (plugin-chart-table page-size Select targets it)', () => {
  const { container } = render(
    <Select ariaLabel="suffix" options={[{ label: 'A', value: 'a' }]} />,
  );
  // antd 6 renamed the Select arrow container `.ant-select-arrow` -> `.ant-select-suffix`.
  expect(antClasses(container)).toContain('ant-select-suffix');
});

test('Collapse panel/body classes (Collapse.tsx, VizTypeGallery, config modals)', () => {
  // antd 6 renamed the Collapse content family: .ant-collapse-content ->
  // .ant-collapse-panel and .ant-collapse-content-box -> .ant-collapse-body
  // (with -active/-hidden moving to the panel). Several styled overrides and
  // Cypress helpers walk these classes.
  const { container } = render(
    <Collapse
      defaultActiveKey={['1']}
      items={[
        { key: '1', label: 'One', children: <div>open</div> },
        { key: '2', label: 'Two', children: <div>closed</div> },
      ]}
    />,
  );
  const classes = antClasses(container);
  expect(classes).toEqual(
    expect.arrayContaining([
      'ant-collapse-item',
      'ant-collapse-panel',
      'ant-collapse-panel-active',
      'ant-collapse-body',
    ]),
  );
  expect(classes).not.toContain('ant-collapse-content');
  expect(classes).not.toContain('ant-collapse-content-box');
});

test('Modal container + body classes (many *.styles.ts modal overrides target them)', () => {
  render(
    <Modal open title="t">
      body
    </Modal>,
  );
  const classes = antClasses(document.body);
  // antd 6 renamed the modal content wrapper `.ant-modal-content` ->
  // `.ant-modal-container`. Several `.styles.ts` overrides target it, and Select /
  // popup `getPopupContainer`/`.closest()` lookups anchor popups to it so their
  // menus stay clipped inside the modal. `-body`/`-close` are unchanged but the
  // report-screenshot error-modal flow in `webdriver.py` walks all three, so pin
  // the whole chain it depends on.
  expect(classes).toEqual(
    expect.arrayContaining([
      'ant-modal-container',
      'ant-modal-body',
      'ant-modal-close',
    ]),
  );
  expect(classes).not.toContain('ant-modal-content');
});

test.each([
  [
    'Select',
    <Select
      ariaLabel="in-modal"
      options={[{ label: 'Alpha', value: 'a' }]}
      key="sync"
    />,
  ],
  [
    'AsyncSelect',
    <AsyncSelect
      ariaLabel="in-modal"
      options={async () => ({
        data: [{ label: 'Alpha', value: 'a' }],
        totalCount: 1,
      })}
      key="async"
    />,
  ],
])(
  '%s popup mounts inside the enclosing modal container',
  async (_name, select) => {
    // Select/AsyncSelect anchor their popup with
    // `triggerNode.closest('.ant-modal-container')` so the menu is clipped by
    // the modal instead of escaping to <body> and scrolling away from its
    // trigger. The class contract above only proves the class exists — this
    // asserts the containment behaviour it exists for.
    render(
      <SupersetModal show title="t" onHide={() => {}}>
        {select}
      </SupersetModal>,
    );
    await userEvent.click(screen.getByRole('combobox'));
    await screen.findByTitle('Alpha');

    await waitFor(() => {
      const popup = document.querySelector('.ant-select-dropdown');
      expect(popup).not.toBeNull();
      // Assert the *direct* parent, not just an ancestor: when the `.closest()`
      // lookup misses, the `triggerNode.parentNode` fallback still sits inside
      // the modal, so an `ancestor` check passes either way and proves nothing.
      expect(popup?.parentElement).toHaveClass('ant-modal-container');
    });
  },
);

test('Progress rail/track classes (ProgressBar + DatabaseModal striped overrides target them)', () => {
  const { container } = render(<Progress percent={50} />);
  const classes = antClasses(container);
  // antd 6 renamed `.ant-progress-inner` -> `.ant-progress-rail` and
  // `.ant-progress-bg` -> `.ant-progress-track`. ProgressBar's styled wrapper
  // paints the striped gradient on the track; DatabaseModal sizes the rail.
  expect(classes).toEqual(
    expect.arrayContaining(['ant-progress-rail', 'ant-progress-track']),
  );
  expect(classes).not.toContain('ant-progress-inner');
  expect(classes).not.toContain('ant-progress-bg');
});

test('Alert title/actions classes (ImportModal, DatabaseModal, SqlEditor, native-filter overrides target them)', () => {
  const { container } = render(
    <Alert
      type="info"
      title="msg"
      description="desc"
      action={<span>x</span>}
    />,
  );
  const classes = antClasses(container);
  // antd 6 renamed `.ant-alert-message` -> `.ant-alert-title` and pluralised the
  // action slot `.ant-alert-action` -> `.ant-alert-actions`. Several `.styles.ts`
  // overrides and the SQL Lab / native-filter modal footers target these.
  expect(classes).toEqual(
    expect.arrayContaining(['ant-alert-title', 'ant-alert-actions']),
  );
  expect(classes).not.toContain('ant-alert-message');
  expect(classes).not.toContain('ant-alert-action');
});

test('Spin nested structure (Table/VirtualTable spinner sizing overrides target it)', () => {
  const { container } = render(
    <Spin spinning>
      <div>content</div>
    </Spin>,
  );
  const classes = antClasses(container);
  // antd 6 dropped the `.ant-spin-nested-loading` wrapper: `.ant-spin` is now the
  // outer element and `.ant-spin-dot` lives beneath it. Table/VirtualTable size the
  // dot via `.ant-spin .ant-spin-dot`, so that descendant chain must hold.
  expect(classes).toEqual(
    expect.arrayContaining(['ant-spin', 'ant-spin-container', 'ant-spin-dot']),
  );
  expect(classes).not.toContain('ant-spin-nested-loading');
  expect(
    container.querySelector('.ant-spin-dot')?.closest('.ant-spin'),
  ).not.toBeNull();
});

test('Tag keeps its v5 trailing margin (GlobalStyles parity rule)', () => {
  // antd 6 removed the Tag's default margin-inline-end: 8px, expecting
  // parents to space tags via flex/Space gaps. App layouts rely on the v5
  // default (e.g. the dashboard header's Published tag sat flush against
  // the metadata bar without it), so GlobalStyles restores it. The spec
  // renderer mounts SupersetThemeProvider, which renders GlobalStyles, so
  // the computed style asserts the whole chain.
  const { getByText } = render(<Tag>spacing</Tag>);
  const tag = getByText('spacing').closest('.ant-tag') as HTMLElement;
  expect(getComputedStyle(tag).getPropertyValue('margin-inline-end')).toBe(
    '8px',
  );
});
