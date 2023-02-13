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
import React from 'react';
import { ReactWrapper } from 'enzyme';
import { styledMount as mount } from 'spec/helpers/theming';
import Button from 'src/components/Button';
import { AsyncSelect } from 'src/components';
import {
  ChartCreation,
  ChartCreationProps,
  ChartCreationState,
} from 'src/pages/ChartCreation';
import VizTypeGallery from 'src/explore/components/controls/VizTypeControl/VizTypeGallery';
import { act } from 'spec/helpers/testing-library';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

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

async function getWrapper(user = mockUser) {
  const wrapper = mount(
    <ChartCreation user={user} addSuccessToast={() => null} {...routeProps} />,
  ) as unknown as ReactWrapper<
    ChartCreationProps,
    ChartCreationState,
    ChartCreation
  >;
  await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  return wrapper;
}

test('renders a select and a VizTypeGallery', async () => {
  const wrapper = await getWrapper();
  expect(wrapper.find(AsyncSelect)).toExist();
  expect(wrapper.find(VizTypeGallery)).toExist();
});

test('renders dataset help text when user lacks dataset write permissions', async () => {
  const wrapper = await getWrapper();
  expect(wrapper.find('[data-test="dataset-write"]')).not.toExist();
  expect(wrapper.find('[data-test="no-dataset-write"]')).toExist();
});

test('renders dataset help text when user has dataset write permissions', async () => {
  const wrapper = await getWrapper(mockUserWithDatasetWrite);
  expect(wrapper.find('[data-test="dataset-write"]')).toExist();
  expect(wrapper.find('[data-test="no-dataset-write"]')).not.toExist();
});

test('renders a button', async () => {
  const wrapper = await getWrapper();
  expect(wrapper.find(Button)).toExist();
});

test('renders a disabled button if no datasource is selected', async () => {
  const wrapper = await getWrapper();
  expect(
    wrapper.find(Button).find({ disabled: true }).hostNodes(),
  ).toHaveLength(1);
});

test('renders an enabled button if datasource and viz type are selected', async () => {
  const wrapper = await getWrapper();
  wrapper.setState({
    datasource,
    vizType: 'table',
  });
  expect(
    wrapper.find(Button).find({ disabled: true }).hostNodes(),
  ).toHaveLength(0);
});

test('double-click viz type does nothing if no datasource is selected', async () => {
  const wrapper = await getWrapper();
  wrapper.instance().gotoSlice = jest.fn();
  wrapper.update();
  wrapper.instance().onVizTypeDoubleClick();
  expect(wrapper.instance().gotoSlice).not.toBeCalled();
});

test('double-click viz type submits if datasource is selected', async () => {
  const wrapper = await getWrapper();
  wrapper.instance().gotoSlice = jest.fn();
  wrapper.update();
  wrapper.setState({
    datasource,
    vizType: 'table',
  });

  wrapper.instance().onVizTypeDoubleClick();
  expect(wrapper.instance().gotoSlice).toBeCalled();
});

test('formats Explore url', async () => {
  const wrapper = await getWrapper();
  wrapper.setState({
    datasource,
    vizType: 'table',
  });
  const formattedUrl = '/explore/?viz_type=table&datasource=1';
  expect(wrapper.instance().exploreUrl()).toBe(formattedUrl);
});
