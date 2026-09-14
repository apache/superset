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
import { render, screen } from 'spec/helpers/testing-library';
import { getMockStore } from 'spec/fixtures/mockStore';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
} from 'src/dashboard/util/constants';
import DashboardComponent from './DashboardComponent';

jest.mock('src/dashboard/components/gridComponents', () => ({
  componentLookup: {
    ROW: ({ component }: { component: { id: string } }) => (
      <div data-test={`rendered-${component.id}`} />
    ),
  },
}));

/**
 * A stored layout can name a component that is also one of its own
 * ancestors. Every nested component renders through this container, so
 * rendering such a reference again recurses until the renderer dies and the
 * dashboard never appears. The repeat has to stop here.
 */
const cyclicLayout = {
  [DASHBOARD_ROOT_ID]: {
    id: DASHBOARD_ROOT_ID,
    type: 'ROOT',
    children: [DASHBOARD_GRID_ID],
    parents: [],
    meta: {},
  },
  [DASHBOARD_GRID_ID]: {
    id: DASHBOARD_GRID_ID,
    type: 'GRID',
    children: ['ROW-a'],
    parents: [DASHBOARD_ROOT_ID],
    meta: {},
  },
  'ROW-a': {
    id: 'ROW-a',
    type: 'ROW',
    children: ['ROW-b'],
    parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
    meta: {},
  },
  'ROW-b': {
    id: 'ROW-b',
    type: 'ROW',
    children: ['ROW-a'],
    parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'ROW-a'],
    meta: {},
  },
};

const renderComponent = (id: string, parentId: string) =>
  render(<DashboardComponent id={id} parentId={parentId} depth={1} />, {
    useRedux: true,
    store: getMockStore({
      dashboardLayout: { past: [], present: cyclicLayout, future: [] },
    }),
  });

test('renders a component whose parent is not one of its descendants', () => {
  renderComponent('ROW-a', DASHBOARD_GRID_ID);

  expect(screen.getByTestId('rendered-ROW-a')).toBeInTheDocument();
});

test('renders nothing when the layout reaches a component from its own descendant', () => {
  const { container } = renderComponent('ROW-a', 'ROW-b');

  expect(screen.queryByTestId('rendered-ROW-a')).not.toBeInTheDocument();
  expect(container).toBeEmptyDOMElement();
});

test('renders nothing when a component is listed as its own child', () => {
  const { container } = renderComponent('ROW-a', 'ROW-a');

  expect(container).toBeEmptyDOMElement();
});
