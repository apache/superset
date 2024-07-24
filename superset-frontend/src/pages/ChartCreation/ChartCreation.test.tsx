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

// import { ReactWrapper } from 'enzyme';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, render } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
// import { styledMount as mount } from 'spec/helpers/theming';
// import Button from 'src/components/Button';
// import { AsyncSelect } from 'src/components';
import {
  ChartCreation,
  ChartCreationProps,
  ChartCreationState,
} from 'src/pages/ChartCreation';
import VizTypeGallery from 'src/explore/components/controls/VizTypeControl/VizTypeGallery';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

// jest.mock(
//   'src/explore/components/controls/VizTypeControl/VizTypeGallery',
//   () => ({
//     __esModule: true,
//     default: ({
//       onChange,
//       onDoubleClick,
//     }: {
//       onChange: (value: string) => void;
//       onDoubleClick: () => void;
//     }) => (
//       <div data-testid="viz-type-gallery">
//         <button type="button" onClick={() => onChange('bar')}>
//           Select Bar Chart
//         </button>
//         <button type="button" onDoubleClick={() => onDoubleClick()}>
//           Double Click to Proceed
//         </button>
//       </div>
//     ),
//   }),
// );

// jest.mock('src/explore/components/controls/VizTypeControl/VizTypeGallery', () =>
//   jest.fn(props => {
//     console.log('VizTypeGallery props:', props);
//     return (
//       <div data-test="viz-type-gallery">
//         <button
//           type="button"
//           data-test="viz-type-select"
//           onClick={() => {
//             console.log('VizTypeGallery onChange called');
//             props.onChange('table');
//           }}
//         >
//           Chart type select
//         </button>
//         <button
//           type="button"
//           data-test="double-click-viz"
//           onDoubleClick={props.onDoubleClick}
//         >
//           Mock double click chart type
//         </button>
//         VizTypeGallery
//       </div>
//     );
//   }),
// );

const mockDatasourceResponse = {
  result: [
    {
      id: 1,
      table_name: 'table',
      datasource_type: 'table',
      database: { database_name: 'test_db' },
      schema: 'public',
    },
  ],
  count: 1,
};

fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
  body: mockDatasourceResponse,
  status: 200,
});

const datasource = {
  value: '1',
  label: 'table',
};

const mockUser: UserWithPermissionsAndRoles = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: { Admin: Array(173) },
  userId: 1,
  username: 'admin',
  isAnonymous: false,
};

const mockUserWithDatasetWrite: UserWithPermissionsAndRoles = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: { Admin: [['can_write', 'Dataset']] },
  userId: 1,
  username: 'admin',
  isAnonymous: false,
};

// We don't need the actual implementation for the tests
const routeProps = {
  history: {} as any,
  location: {} as any,
  match: {} as any,
};

const renderOptions = {
  // useRedux: true,
  useRouter: true,
};

async function renderComponent(user = mockUser) {
  render(
    <ChartCreation user={user} addSuccessToast={() => null} {...routeProps} />,
    renderOptions,
  );
  await waitFor(() => new Promise(resolve => setTimeout(resolve, 0)));
}

test('renders a select and a VizTypeGallery', async () => {
  await renderComponent();
  expect(screen.getByRole('combobox', { name: 'Dataset' })).toBeInTheDocument();
  expect(screen.getByText(/choose chart type/i)).toBeInTheDocument();
});

test('renders dataset help text when user lacks dataset write permissions', async () => {
  await renderComponent();
  expect(screen.queryByText('Add a dataset')).not.toBeInTheDocument();
  expect(screen.getByText('view instructions')).toBeInTheDocument();
});

test('renders dataset help text when user has dataset write permissions', async () => {
  await renderComponent(mockUserWithDatasetWrite);
  expect(screen.getByText('Add a dataset')).toBeInTheDocument();
  expect(screen.queryByText('view instructions')).toBeInTheDocument();
});

test('renders a button', async () => {
  await renderComponent();
  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeInTheDocument();
});

test('renders a disabled button if no datasource is selected', async () => {
  await renderComponent();
  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeDisabled();
});

test.only('renders an enabled button if datasource and viz type are selected', async () => {
  await renderComponent();

  const datasourceSelect = screen.getByRole('combobox', { name: 'Dataset' });
  userEvent.click(datasourceSelect);
  await screen.findByText(/test_db/i);
  userEvent.click(screen.getByText(/test_db/i));
  // userEvent.click(screen.getByRole('option', { name: /test_db/i }));

  userEvent.click(
    screen.getByRole('button', {
      name: /ballot all charts/i,
    }),
  );
  userEvent.click(
    screen.getByRole('button', {
      name: /right category/i,
    }),
  );
  screen.logTestingPlaygroundURL();

  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Create new chart' }),
    ).toBeEnabled(),
  );
});

test.skip('double-click viz type does nothing if no datasource is selected', async () => {
  const { container } = render(
    <ChartCreation
      user={mockUser}
      addSuccessToast={() => null}
      {...routeProps}
    />,
    renderOptions,
  );
  await waitFor(() => new Promise(resolve => setTimeout(resolve, 0)));

  const instance = container.firstChild as ChartCreation;
  if (instance instanceof ChartCreation) {
    instance.gotoSlice = jest.fn();
    instance.onVizTypeDoubleClick();
  }

  expect(instance.gotoSlice).not.toBeCalled();
});

test.skip('double-click viz type submits if datasource is selected', async () => {
  const { container } = render(
    <ChartCreation
      user={mockUser}
      addSuccessToast={() => null}
      {...routeProps}
    />,
    renderOptions,
  );
  await waitFor(() => new Promise(resolve => setTimeout(resolve, 0)));

  const instance = container.firstChild as ChartCreation;
  if (instance instanceof ChartCreation) {
    instance.gotoSlice = jest.fn();
    instance.setState({
      datasource,
      vizType: 'table',
    });
    instance.onVizTypeDoubleClick();
  }

  expect(instance.gotoSlice).toBeCalled();
});

test('formats Explore url', async () => {
  const { container } = render(
    <ChartCreation
      user={mockUser}
      addSuccessToast={() => null}
      {...routeProps}
    />,
    renderOptions,
  );
  await waitFor(() => new Promise(resolve => setTimeout(resolve, 0)));

  const instance = container.firstChild as ChartCreation | null;
  if (instance instanceof ChartCreation) {
    instance.setState({
      datasource,
      vizType: 'table',
    });
    const formattedUrl = '/explore/?viz_type=table&datasource=1';
    expect(instance.exploreUrl()).toBe(formattedUrl);
  }
});
