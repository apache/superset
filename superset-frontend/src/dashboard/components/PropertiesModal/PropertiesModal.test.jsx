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
import { styledMount as mount } from 'spec/helpers/theming';
import { Provider } from 'react-redux';
import fetchMock from 'fetch-mock';

import {
  supersetTheme,
  SupersetClient,
  ThemeProvider,
} from '@superset-ui/core';

import Modal from 'src/components/Modal';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import { mockStore } from 'spec/fixtures/mockStore';

const dashboardResult = {
  json: {
    result: {
      dashboard_title: 'New Title',
      slug: '/new',
      json_metadata: '{"something":"foo"}',
      owners: [],
      roles: [],
    },
  },
};

fetchMock.restore();

fetchMock.get('glob:*/api/v1/dashboard/related/owners?*', {
  result: [],
});

fetchMock.get('glob:*/api/v1/dashboard/*', {
  result: {
    dashboard_title: 'New Title',
    slug: '/new',
    json_metadata: '{"something":"foo"}',
    owners: [],
    roles: [],
  },
});

const requiredProps = {
  dashboardId: 1,
  show: true,
  addSuccessToast: () => {},
};

const setup = overrideProps =>
  mount(
    <Provider store={mockStore}>
      <PropertiesModal {...requiredProps} {...overrideProps} />
    </Provider>,
    {
      wrappingComponent: ThemeProvider,
      wrappingComponentProps: { theme: supersetTheme },
    },
  );

// all these tests need to be moved to dashboard/components/PropertiesModal/PropertiesModal.test.tsx
describe.skip('PropertiesModal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  describe('onColorSchemeChange', () => {
    it('sets up a default state', () => {
      const wrapper = setup({ colorScheme: 'SUPERSET_DEFAULT' });
      expect(
        wrapper.find('PropertiesModal').instance().state.values.colorScheme,
      ).toEqual('SUPERSET_DEFAULT');
    });
    describe('with a valid color scheme as an arg', () => {
      describe('without metadata', () => {
        const wrapper = setup({ colorScheme: 'SUPERSET_DEFAULT' });
        const modalInstance = wrapper.find('PropertiesModal').instance();
        it('updates the color scheme in the metadata', () => {
          const spy = jest.spyOn(modalInstance, 'onMetadataChange');
          modalInstance.onColorSchemeChange('SUPERSET_DEFAULT');
          expect(spy).toHaveBeenCalledWith(
            '{"something": "foo", "color_scheme": "SUPERSET_DEFAULT", "label_colors": {}}',
          );
        });
      });
      describe('with metadata', () => {
        describe('with color_scheme in the metadata', () => {
          it('will update the metadata', () => {
            const wrapper = setup();
            const modalInstance = wrapper.find('PropertiesModal').instance();
            modalInstance.setState({
              values: {
                json_metadata: '{"color_scheme": "foo"}',
              },
            });
            const spy = jest.spyOn(modalInstance, 'onMetadataChange');
            modalInstance.onColorSchemeChange('SUPERSET_DEFAULT');
            expect(spy).toHaveBeenCalledWith(
              '{"color_scheme": "SUPERSET_DEFAULT", "label_colors": {}}',
            );
          });
        });
        it('without color_scheme in the metadata', () => {
          const wrapper = setup();
          const modalInstance = wrapper.find('PropertiesModal').instance();
          modalInstance.setState({
            values: {
              json_metadata: '{"timed_refresh_immune_slices": []}',
            },
          });
          it('will update the metadata', () => {
            const spy = jest.spyOn(modalInstance, 'onMetadataChange');
            modalInstance.onColorSchemeChange('SUPERSET_DEFAULT');
            expect(spy).toHaveBeenCalledWith(
              '{"something": "foo", "color_scheme": "SUPERSET_DEFAULT", "label_colors": {}}',
            );
          });
        });
      });
    });
    describe('with an invalid color scheme as an arg', () => {
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      it('will raise an error', () => {
        const spy = jest.spyOn(Modal, 'error');
        expect(() =>
          modalInstance.onColorSchemeChange('THIS_WILL_NOT_WORK'),
        ).toThrowError('A valid color scheme is required');
        expect(spy).toHaveBeenCalled();
      });
    });
    describe('with an empty color scheme as an arg', () => {
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      it('will not raise an error', () => {
        const spy = jest.spyOn(Modal, 'error');
        modalInstance.onColorSchemeChange('');
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });
  describe('onOwnersChange', () => {
    it('should update the state with the value passed', () => {
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      const spy = jest.spyOn(modalInstance, 'updateFormState');
      const newOwners = [{ value: 1, label: 'foo' }];
      modalInstance.onOwnersChange(newOwners);
      expect(spy).toHaveBeenCalledWith('owners', newOwners);
    });
  });
  describe('onMetadataChange', () => {
    it('should update the state with the value passed', () => {
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      const spy = jest.spyOn(modalInstance, 'updateFormState');
      modalInstance.onMetadataChange('foo');
      expect(spy).toHaveBeenCalledWith('json_metadata', 'foo');
    });
  });
  describe('onChange', () => {
    it('should update the state with the value passed', () => {
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      const spy = jest.spyOn(modalInstance, 'updateFormState');
      modalInstance.onChange({ target: { name: 'test', value: 'foo' } });
      expect(spy).toHaveBeenCalledWith('test', 'foo');
    });
  });
  describe('fetchDashboardDetails', () => {
    it('should make an api call', () => {
      const spy = jest.spyOn(SupersetClient, 'get');
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      modalInstance.fetchDashboardDetails();
      expect(spy).toHaveBeenCalledWith({
        endpoint: '/api/v1/dashboard/1',
      });
    });

    it('should update state', async () => {
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      const fetchSpy = jest
        .spyOn(SupersetClient, 'get')
        .mockResolvedValue(dashboardResult);
      modalInstance.fetchDashboardDetails();
      await fetchSpy();
      expect(modalInstance.state.values.colorScheme).toBeUndefined();
      expect(modalInstance.state.values.dashboard_title).toEqual('New Title');
      expect(modalInstance.state.values.slug).toEqual('/new');
      expect(modalInstance.state.values.json_metadata).toEqual(
        '{"something": "foo"}',
      );
    });

    it('should call onOwnersChange', async () => {
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: {
          result: {
            dashboard_title: 'New Title',
            slug: '/new',
            json_metadata: '{"something":"foo"}',
            owners: [{ id: 1, first_name: 'Al', last_name: 'Pacino' }],
            roles: [],
          },
        },
      });
      const onOwnersSpy = jest.spyOn(modalInstance, 'onOwnersChange');
      modalInstance.fetchDashboardDetails();
      await fetchSpy();
      expect(modalInstance.state.values.colorScheme).toBeUndefined();
      expect(onOwnersSpy).toHaveBeenCalledWith([
        { value: 1, label: 'Al Pacino' },
      ]);
    });

    it('should call onRolesChange', async () => {
      const wrapper = setup();
      const modalInstance = wrapper.find('PropertiesModal').instance();
      const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
        json: {
          result: {
            dashboard_title: 'New Title',
            slug: '/new',
            json_metadata: '{"something":"foo"}',
            owners: [],
            roles: [{ id: 1, name: 'Alpha' }],
          },
        },
      });
      const onRolwesSpy = jest.spyOn(modalInstance, 'onRolesChange');
      modalInstance.fetchDashboardDetails();
      await fetchSpy();
      expect(modalInstance.state.values.colorScheme).toBeUndefined();
      expect(onRolwesSpy).toHaveBeenCalledWith([{ value: 1, label: 'Alpha' }]);
    });

    describe('when colorScheme is undefined as a prop', () => {
      describe('when color_scheme is defined in json_metadata', () => {
        const wrapper = setup();
        const modalInstance = wrapper.find('PropertiesModal').instance();
        it('should use the color_scheme from json_metadata in the api response', async () => {
          const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
            json: {
              result: {
                dashboard_title: 'New Title',
                slug: '/new',
                json_metadata: '{"color_scheme":"SUPERSET_DEFAULT"}',
                owners: [],
                roles: [],
              },
            },
          });
          modalInstance.fetchDashboardDetails();

          // this below triggers the callback of the api call
          await fetchSpy();

          expect(modalInstance.state.values.colorScheme).toEqual(
            'SUPERSET_DEFAULT',
          );
        });
        describe('when color_scheme is not defined in json_metadata', () => {
          const wrapper = setup();
          const modalInstance = wrapper.find('PropertiesModal').instance();
          it('should be undefined', async () => {
            const fetchSpy = jest
              .spyOn(SupersetClient, 'get')
              .mockResolvedValue(dashboardResult);
            modalInstance.fetchDashboardDetails();
            await fetchSpy();
            expect(modalInstance.state.values.colorScheme).toBeUndefined();
          });
        });
      });
    });
    describe('when colorScheme is defined as a prop', () => {
      describe('when color_scheme is defined in json_metadata', () => {
        const wrapper = setup({ colorScheme: 'SUPERSET_DEFAULT' });
        const modalInstance = wrapper.find('PropertiesModal').instance();
        it('should use the color_scheme from json_metadata in the api response', async () => {
          const fetchSpy = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
            json: {
              result: {
                dashboard_title: 'New Title',
                slug: '/new',
                json_metadata: '{"color_scheme":"SUPERSET_DEFAULT"}',
                owners: [],
                roles: [],
              },
            },
          });
          modalInstance.fetchDashboardDetails();
          await fetchSpy();
          expect(modalInstance.state.values.colorScheme).toEqual(
            'SUPERSET_DEFAULT',
          );
        });
      });
      describe('when color_scheme is not defined in json_metadata', () => {
        const wrapper = setup({ colorScheme: 'SUPERSET_DEFAULT' });
        const modalInstance = wrapper.find('PropertiesModal').instance();
        it('should use the colorScheme from the prop', async () => {
          const fetchSpy = jest
            .spyOn(SupersetClient, 'get')
            .mockResolvedValue(dashboardResult);
          modalInstance.fetchDashboardDetails();
          await fetchSpy();
          expect(modalInstance.state.values.colorScheme).toBeUndefined();
        });
      });
    });
  });
});
