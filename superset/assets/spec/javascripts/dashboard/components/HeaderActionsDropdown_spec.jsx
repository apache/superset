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

  it('read-only', () => {
    const overrideProps = { userCanSave: false };

    const wrapper = setup(overrideProps);
    expect(wrapper.find(DropdownButton)).to.have.lengthOf(1);

    expect(wrapper.find(SaveModal)).to.have.lengthOf(0);

    expect(wrapper.find(MenuItem)).to.have.lengthOf(1);
    expect(wrapper.find(RefreshIntervalModal)).to.have.lengthOf(1);

    expect(wrapper.find(URLShortLinkModal)).to.have.lengthOf(1);
    expect(wrapper.find(CssEditor)).to.have.lengthOf(0);
  });

  it('write user', () => {
    const overrideProps = { userCanSave: true };

    const wrapper = setup(overrideProps);
    expect(wrapper.find(DropdownButton)).to.have.lengthOf(1);

    expect(wrapper.find(SaveModal)).to.have.lengthOf(1);

    expect(wrapper.find(MenuItem)).to.have.lengthOf(2);
    expect(wrapper.find(RefreshIntervalModal)).to.have.lengthOf(1);

    expect(wrapper.find(URLShortLinkModal)).to.have.lengthOf(1);
    expect(wrapper.find(CssEditor)).to.have.lengthOf(0);
  });

  it('write user with editMode', () => {
    const overrideProps = { userCanSave: true, editMode: true };

    const wrapper = setup(overrideProps);
    expect(wrapper.find(DropdownButton)).to.have.lengthOf(1);

    expect(wrapper.find(SaveModal)).to.have.lengthOf(1);

    expect(wrapper.find(MenuItem)).to.have.lengthOf(3);
    expect(wrapper.find(RefreshIntervalModal)).to.have.lengthOf(1);

    expect(wrapper.find(URLShortLinkModal)).to.have.lengthOf(1);
    expect(wrapper.find(CssEditor)).to.have.lengthOf(1);
  });
});
