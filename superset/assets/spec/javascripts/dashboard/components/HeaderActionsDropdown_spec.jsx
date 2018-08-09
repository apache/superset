import React from 'react';
import { describe, it } from 'mocha';
import { expect } from 'chai';
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
      expect(wrapper.find(DropdownButton)).to.have.lengthOf(1);
    });

    it('should not render the SaveModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(SaveModal)).to.have.lengthOf(0);
    });

    it('should render one MenuItem', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(MenuItem)).to.have.lengthOf(1);
    });

    it('should render the RefreshIntervalModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(RefreshIntervalModal)).to.have.lengthOf(1);
    });

    it('should render the URLShortLinkModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(URLShortLinkModal)).to.have.lengthOf(1);
    });

    it('should not render the CssEditor', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(CssEditor)).to.have.lengthOf(0);
    });
  });

  describe('write-user', () => {
    const overrideProps = { userCanSave: true };

    it('should render the DropdownButton', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(DropdownButton)).to.have.lengthOf(1);
    });

    it('should render the SaveModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(SaveModal)).to.have.lengthOf(1);
    });

    it('should render two MenuItems', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(MenuItem)).to.have.lengthOf(2);
    });

    it('should render the RefreshIntervalModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(RefreshIntervalModal)).to.have.lengthOf(1);
    });

    it('should render the URLShortLinkModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(URLShortLinkModal)).to.have.lengthOf(1);
    });

    it('should not render the CssEditor', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(CssEditor)).to.have.lengthOf(0);
    });
  });

  describe('write-user-with-edit-mode', () => {
    const overrideProps = { userCanSave: true, editMode: true };

    it('should render the DropdownButton', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(DropdownButton)).to.have.lengthOf(1);
    });

    it('should render the SaveModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(SaveModal)).to.have.lengthOf(1);
    });

    it('should render three MenuItems', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(MenuItem)).to.have.lengthOf(3);
    });

    it('should render the RefreshIntervalModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(RefreshIntervalModal)).to.have.lengthOf(1);
    });

    it('should render the URLShortLinkModal', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(URLShortLinkModal)).to.have.lengthOf(1);
    });

    it('should render the CssEditor', () => {
      const wrapper = setup(overrideProps);
      expect(wrapper.find(CssEditor)).to.have.lengthOf(1);
    });
  });
});
