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
import { render, screen } from '@superset-ui/core/spec';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import DetailBlock from './DetailBlock';
import { TreeTableContainer } from './styles';

test('the expand toggle uses a 16px box, text and border tokens, and a whole-pixel vertical inset', () => {
  render(<TreeTableContainer height={400} data-test="tree-styles" />);
  const styles = screen.getByTestId('tree-styles');
  const button = { target: /\.ag-row \.ant-btn\.tree-table-expand$/ };
  expect(styles).toHaveStyleRule('width', '16px', button);
  expect(styles).toHaveStyleRule('height', '16px', button);
  expect(styles).toHaveStyleRule('color', supersetTheme.colorText, button);
  expect(styles).toHaveStyleRule(
    'border',
    `1px solid ${supersetTheme.colorBorder}`,
    button,
  );
  expect(styles).toHaveStyleRule(
    'inset-block-start',
    'round(down, calc((100% - 16px) / 2), 1px)',
    button,
  );
});

test('only populated child auto-height bodies lose their minimum height', () => {
  const defaults = document.createElement('style');
  defaults.textContent = '.ag-grid-scrolling-rows { min-height: 150px; }';
  document.head.prepend(defaults);
  try {
    render(
      <TreeTableContainer height={400}>
        <div className="ag-grid-scrolling-rows" data-test="parent-body" />
        <div
          className="ag-grid-scrolling-rows ag-layout-auto-height"
          data-test="other-auto-body"
        />
        <div className="tree-table-child-group">
          <div
            className="ag-grid-scrolling-rows ag-layout-auto-height"
            data-test="child-body"
          >
            <div className="ag-row">First row</div>
            <div className="ag-row">Second row</div>
          </div>
          <div
            className="ag-grid-scrolling-rows ag-layout-auto-height"
            data-test="empty-child-body"
          >
            No Rows To Show
          </div>
        </div>
      </TreeTableContainer>,
    );
    expect(
      getComputedStyle(screen.getByTestId('child-body')).minHeight,
    ).toMatch(/^0(px)?$/);
    for (const name of ['parent-body', 'other-auto-body', 'empty-child-body']) {
      expect(getComputedStyle(screen.getByTestId(name)).minHeight).toBe(
        '150px',
      );
    }
    expect(screen.getByText('No Rows To Show')).toBeVisible();
  } finally {
    defaults.remove();
  }
});

test('long detail labels truncate with their full label in a title', () => {
  const label = 'display_name_override';
  render(
    <TreeTableContainer height={400}>
      <DetailBlock
        level={{
          key: 'parent',
          name: 'Parent',
          id_column: 'parent',
          columns: [],
          detail_fields: [label],
        }}
        row={{ [label]: 'A long detail value may still wrap' }}
        columns={[{ key: label, label, dataType: GenericDataType.String }]}
      />
    </TreeTableContainer>,
  );
  const element = screen.getByText(label);
  expect(element).toHaveAttribute('title', label);
  expect(getComputedStyle(element).whiteSpace).toBe('nowrap');
  expect(getComputedStyle(element).textOverflow).toBe('ellipsis');
});

test('a child header has a visible keyboard focus outline', () => {
  const { container } = render(
    <TreeTableContainer height={400}>
      <table className="tree-table-child-group">
        <thead>
          <tr>
            <th className="ag-header-cell" tabIndex={0}>
              Children
            </th>
          </tr>
        </thead>
      </table>
    </TreeTableContainer>,
  );
  const header = container.querySelector<HTMLElement>('.ag-header-cell')!;
  header.focus();
  expect(header).toHaveFocus();
  expect(getComputedStyle(header).outline).toMatch(/^2px solid /);
  expect(getComputedStyle(header).outlineOffset).toBe('-2px');
});
