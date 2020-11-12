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
import { shallow } from 'enzyme';
import { Menu, NoAnimationDropdown } from 'src/common/components';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';
import URLShortLinkModal from 'src/components/URLShortLinkModal';
import HeaderActionsDropdown from 'src/dashboard/components/HeaderActionsDropdown';
import SaveModal from 'src/dashboard/components/SaveModal';
import CssEditor from 'src/dashboard/components/CssEditor';

describe('HeaderActionsDropdown', () => {
  const props = {
    addSuccessToast: () => {},
    addDangerToast: () => {},
    customCss: '',
    dashboardId: 1,
    dashboardInfo: {},
    dashboardTitle: 'Title',
    editMode: false,
    expandedSlices: {},
    filters: {},
    forceRefreshAllCharts: () => {},
    hasUnsavedChanges: false,
    isLoading: false,
    layout: {},
    onChange: () => {},
    onSave: () => {},
    refreshFrequency: 200,
    setRefreshFrequency: () => {},
    shouldPersistRefreshFrequency: true,
    showPropertiesModal: () => {},
    startPeriodicRender: () => {},
    updateCss: () => {},
    userCanEdit: false,
    userCanSave: false,
  };

  function setup(overrideProps) {
    const wrapper = shallow(
      <HeaderActionsDropdown {...props} {...overrideProps} />,
    );
    const menu = shallow(
      <div>{wrapper.find(NoAnimationDropdown).props().overlay}</div>,
    );
    return { wrapper, menu };
  }

  describe('readonly-user', () => {
    const overrideProps = { userCanSave: false };

    it('should render the DropdownButton', () => {
      const { wrapper } = setup(overrideProps);
      expect(wrapper.find(NoAnimationDropdown)).toExist();
    });

    it('should not render the SaveModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(SaveModal)).not.toExist();
    });

    it('should render five Menu items', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(Menu.Item)).toHaveLength(5);
    });

    it('should render the RefreshIntervalModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(RefreshIntervalModal)).toExist();
    });

    it('should render the URLShortLinkModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(URLShortLinkModal)).toExist();
    });

    it('should not render the CssEditor', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(CssEditor)).not.toExist();
    });
  });

  describe('write-user', () => {
    const overrideProps = { userCanSave: true };

    it('should render the DropdownButton', () => {
      const { wrapper } = setup(overrideProps);
      expect(wrapper.find(NoAnimationDropdown)).toExist();
    });

    it('should render the SaveModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(SaveModal)).toExist();
    });

    it('should render six Menu items', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(Menu.Item)).toHaveLength(6);
    });

    it('should render the RefreshIntervalModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(RefreshIntervalModal)).toExist();
    });

    it('should render the URLShortLinkModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(URLShortLinkModal)).toExist();
    });

    it('should not render the CssEditor', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(CssEditor)).not.toExist();
    });
  });

  describe('write-user-with-edit-mode', () => {
    const overrideProps = { userCanSave: true, editMode: true };

    it('should render the DropdownButton', () => {
      const { wrapper } = setup(overrideProps);
      expect(wrapper.find(NoAnimationDropdown)).toExist();
    });

    it('should render the SaveModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(SaveModal)).toExist();
    });

    it('should render seven MenuItems', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(Menu.Item)).toHaveLength(7);
    });

    it('should render the RefreshIntervalModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(RefreshIntervalModal)).toExist();
    });

    it('should render the URLShortLinkModal', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(URLShortLinkModal)).toExist();
    });

    it('should render the CssEditor', () => {
      const { menu } = setup(overrideProps);
      expect(menu.find(CssEditor)).toExist();
    });
  });
});
