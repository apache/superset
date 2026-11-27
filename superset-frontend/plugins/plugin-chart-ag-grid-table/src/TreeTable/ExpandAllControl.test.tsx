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
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@superset-ui/core/spec';
import userEvent from '@testing-library/user-event';
import ExpandAllControl, { expandAllLevels } from './ExpandAllControl';
import { TreeLevel } from './types';
import { TreeTableContainer } from './styles';
import { supersetTheme } from '@apache-superset/core/theme';

const session: TreeLevel = {
  key: 'session',
  name: 'Session',
  name_plural: 'Sessions',
  id_column: 'session_id',
  columns: [],
  detail_fields: [],
};
const step: TreeLevel = {
  key: 'step',
  name: 'Step',
  name_plural: 'Steps',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: [],
  detail_fields: ['result'],
};
const interaction: TreeLevel = {
  ...session,
  key: 'interaction',
  name: 'Interaction',
  name_plural: undefined,
  id_column: 'interaction_id',
};

test.each([
  [[session], []],
  [[{ ...session, detail_fields: ['channel'] }], [1]],
  [[session, { ...step, detail_fields: [] }], [1]],
  [
    [session, step],
    [1, 2],
  ],
])('levels that can open: %#', (levels, expected) => {
  expect(expandAllLevels(levels)).toEqual(expected);
});

test('two levels toggle the same button between expand and collapse', async () => {
  const onChange = jest.fn();
  const onCollapseAll = jest.fn();
  const levels = [session, { ...step, detail_fields: [] }];
  const { rerender } = render(
    <ExpandAllControl
      levels={levels}
      allOpen={false}
      onChange={onChange}
      onCollapseAll={onCollapseAll}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
  expect(onChange).toHaveBeenCalledWith(1);
  rerender(
    <ExpandAllControl
      levels={levels}
      allOpen
      onChange={onChange}
      onCollapseAll={onCollapseAll}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
  expect(onCollapseAll).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test.each([2, 3, 4])(
  '%s levels offer clearly named expansion depths without duplicate collapse',
  async count => {
    const levels =
      count === 2
        ? [session, step]
        : [
            session,
            interaction,
            step,
            { ...step, name: 'Segment', name_plural: 'Segments' },
          ].slice(0, count);
    const onChange = jest.fn();
    const onCollapseAll = jest.fn();
    render(
      <ExpandAllControl
        levels={levels}
        allOpen={false}
        onChange={onChange}
        onCollapseAll={onCollapseAll}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(onChange).toHaveBeenLastCalledWith(count);
    const trigger = screen.getByRole('button', { name: 'Expand all to level' });
    for (let index = 0; index < count; index += 1) {
      await userEvent.click(trigger);
      const items = await screen.findAllByRole('menuitem');
      expect(items.map(item => item.textContent)).toEqual(
        levels.map(level => `Expand to ${level.name_plural || level.name}`),
      );
      await userEvent.click(items[index]);
      expect(onChange).toHaveBeenLastCalledWith(index + 1);
      await waitFor(() => expect(trigger).toHaveFocus());
    }
    await userEvent.click(trigger);
    expect(screen.queryByRole('menuitem', { name: 'Collapse all' })).toBeNull();
  },
);

test('menu keyboard navigation, Enter and Escape return focus', async () => {
  const rect = jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      width: 100,
      height: 24,
      top: 0,
      left: 0,
      right: 100,
      bottom: 24,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  try {
    const onChange = jest.fn();
    render(
      <ExpandAllControl
        levels={[session, interaction, step]}
        allOpen={false}
        onChange={onChange}
        onCollapseAll={jest.fn()}
      />,
    );
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Expand all' })).toHaveFocus();
    await userEvent.tab();
    const trigger = screen.getByRole('button', { name: 'Expand all to level' });
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard('{enter}');
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Expand to Sessions' }),
      ).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
    });
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Expand to Interaction' }),
      ).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
    });
    expect(onChange).toHaveBeenCalledWith(2);
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard('{enter}');
    await screen.findByRole('menu');
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false'),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  } finally {
    rect.mockRestore();
  }
});

test('a last level without detail fields is not offered', async () => {
  render(
    <ExpandAllControl
      levels={[session, interaction, { ...step, detail_fields: [] }]}
      allOpen={false}
      onChange={jest.fn()}
      onCollapseAll={jest.fn()}
    />,
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Expand all to level' }),
  );
  expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(
    ['Expand to Sessions', 'Expand to Interaction'],
  );
});

test('without an openable level there is no toolbar', () => {
  const { container } = render(
    <ExpandAllControl
      levels={[session]}
      allOpen={false}
      onChange={jest.fn()}
      onCollapseAll={jest.fn()}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});

test.each([
  [[session], false],
  [[{ ...session, detail_fields: ['channel'] }], false],
  [[session, { ...step, detail_fields: [] }], false],
  [[session, step], true],
  [[session, interaction, step], true],
])('the menu depends on openable depths: %#', (levels, hasMenu) => {
  render(
    <ExpandAllControl
      levels={levels}
      allOpen={false}
      onChange={jest.fn()}
      onCollapseAll={jest.fn()}
    />,
  );
  expect(
    Boolean(screen.queryByRole('button', { name: 'Expand all to level' })),
  ).toBe(hasMenu);
});

test('toolbar spacing, square arrow and hover feedback preserve readable text', () => {
  render(<TreeTableContainer height={400} data-test="toolbar-styles" />);
  const styles = screen.getByTestId('toolbar-styles');
  expect(styles).toHaveStyleRule('padding-bottom', '8px', {
    target: / \.tree-table-toolbar$/,
  });
  expect(styles).toHaveStyleRule('width', '24px', {
    target: / \.tree-table-toolbar \.ant-btn-icon-only$/,
  });
  expect(styles).toHaveStyleRule('padding-inline', '0', {
    target: / \.tree-table-toolbar \.ant-btn-icon-only$/,
  });
  for (const state of ['hover', 'active']) {
    const target = new RegExp(
      `\\.tree-table-toolbar \\.ant-btn:not\\(:disabled\\):${state}$`,
    );
    expect(styles).toHaveStyleRule('border-color', supersetTheme.colorPrimary, {
      target,
    });
    expect(styles).toHaveStyleRule('color', supersetTheme.colorText, {
      target,
    });
    expect(styles).toHaveStyleRule(
      'background',
      supersetTheme.colorBgContainer,
      { target },
    );
  }
});
