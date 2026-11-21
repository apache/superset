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
/** @jsxImportSource @emotion/react */
import { render } from 'spec/helpers/testing-library';
import { Filter } from '@superset-ui/core';
import { Collapse } from '@superset-ui/core/components/Collapse';
import { FiltersOutOfScopeCollapsible, outOfScopeCollapseStyles } from '.';

jest.mock('@superset-ui/core/components/Collapse', () => {
  const actual = jest.requireActual('@superset-ui/core/components/Collapse');
  return {
    ...actual,
    Collapse: jest.fn((props: Record<string, unknown>) => (
      <actual.Collapse {...props} />
    )),
  };
});

const filter = { id: 'NATIVE_FILTER-1', name: 'Out of scope filter' } as Filter;
const items = [
  {
    key: 'item',
    label: 'Label',
    children: <div>Content</div>,
    forceRender: true,
  },
];

const HEADER = '.ant-collapse-item>.ant-collapse-header';
const BODY = '.ant-collapse-item>.ant-collapse-panel>.ant-collapse-body';

// The `css` prop is not transformed by the jest babel config, so the shared
// style is attached through an emotion-enabled wrapper around the real Collapse.
test('outOfScopeCollapseStyles trims the vertical padding of the antd collapse header and body', () => {
  const { Collapse: ActualCollapse } = jest.requireActual(
    '@superset-ui/core/components/Collapse',
  );
  const { container } = render(
    <div css={outOfScopeCollapseStyles}>
      <ActualCollapse ghost items={items} />
    </div>,
  );

  expect(container.querySelector(HEADER)).toBeInTheDocument();
  expect(container.querySelector(BODY)).toBeInTheDocument();

  const wrapper = container.firstElementChild as Element;
  expect(wrapper).toHaveStyleRule('padding-top', '4px', { target: HEADER });
  expect(wrapper).toHaveStyleRule('padding-bottom', '4px', { target: HEADER });
  expect(wrapper).toHaveStyleRule('padding-bottom', '4px', { target: BODY });
});

test('FiltersOutOfScopeCollapsible applies outOfScopeCollapseStyles to the collapse', () => {
  render(
    <FiltersOutOfScopeCollapsible
      filtersOutOfScope={[filter]}
      renderer={f => <div key={f.id}>{(f as Filter).name}</div>}
    />,
  );

  const [[props]] = (Collapse as unknown as jest.Mock).mock.calls;
  expect(props.css).toBeDefined();
  expect(props.css).toBe(outOfScopeCollapseStyles);
});
