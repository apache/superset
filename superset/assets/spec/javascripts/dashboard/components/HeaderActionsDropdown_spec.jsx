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
import { DropdownButton, MenuItem } from 'react-bootstrap';
import RefreshIntervalModal from '../../../../src/dashboard/components/RefreshIntervalModal';
import URLShortLinkModal from '../../../../src/components/URLShortLinkModal';
import HeaderActionsDropdown from '../../../../src/dashboard/components/HeaderActionsDropdown';
import SaveModal from '../../../../src/dashboard/components/SaveModal';
import CssEditor from '../../../../src/dashboard/components/CssEditor';

describe('HeaderActionsDropdown', () => {
  const props = {
    addSuccessToast: () => {},
    addDangerToast: () => {},
    dashboardId: 1,
    dashboardTitle: 'Title',
    hasUnsavedChanges: false,
    css: '',
    onChange: () => {},
    updateCss: () => {},
    forceRefreshAllCharts: () => {},
    startPeriodicRender: () => {},
    editMode: false,
    userCanEdit: false,
    userCanSave: false,
    layout: {},
    filters: {},
    expandedSlices: {},
    onSave: () => {},
  };

  function setup(overrideProps) {
    const wrapper = shallow(
      <HeaderActionsDropdown {...props} {...overrideProps} />,
    );
    return wrapper;
  }

  describe('readonly-user', () => {
    const overrideProps = { userCanSave: false };

    it('should render the DropdownButton', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(DropdownButton)).toHaveLength(1);
    });

    it('should not render the SaveModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(SaveModal)).toHaveLength(0);
    });

    it('should render one MenuItem', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(MenuItem)).toHaveLength(1);
    });

    it('should render the RefreshIntervalModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(RefreshIntervalModal)).toHaveLength(1);
    });

    it('should render the URLShortLinkModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(URLShortLinkModal)).toHaveLength(1);
    });

    it('should not render the CssEditor', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(CssEditor)).toHaveLength(0);
    });
  });

  describe('write-user', () => {
    const overrideProps = { userCanSave: true };

    it('should render the DropdownButton', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(DropdownButton)).toHaveLength(1);
    });

    it('should render the SaveModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(SaveModal)).toHaveLength(1);
    });

    it('should render two MenuItems', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(MenuItem)).toHaveLength(2);
    });

    it('should render the RefreshIntervalModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(RefreshIntervalModal)).toHaveLength(1);
    });

    it('should render the URLShortLinkModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(URLShortLinkModal)).toHaveLength(1);
    });

    it('should not render the CssEditor', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(CssEditor)).toHaveLength(0);
    });
  });

  describe('write-user-with-edit-mode', () => {
    const overrideProps = { userCanSave: true, editMode: true };

    it('should render the DropdownButton', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(DropdownButton)).toHaveLength(1);
    });

    it('should render the SaveModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(SaveModal)).toHaveLength(1);
    });

    it('should render three MenuItems', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(MenuItem)).toHaveLength(3);
    });

    it('should render the RefreshIntervalModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(RefreshIntervalModal)).toHaveLength(1);
    });

    it('should render the URLShortLinkModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(URLShortLinkModal)).toHaveLength(1);
    });

    it('should render the CssEditor', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(CssEditor)).toHaveLength(1);
    });
  });
});
