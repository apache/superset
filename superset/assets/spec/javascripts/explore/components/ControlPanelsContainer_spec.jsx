import React from 'react';
import { shallow } from 'enzyme';
import { getFormDataFromControls, defaultControls } from 'src/explore/store';
import { ControlPanelsContainer } from 'src/explore/components/ControlPanelsContainer';
import ControlPanelSection from 'src/explore/components/ControlPanelSection';
import * as featureFlags from 'src/featureFlags';

const defaultProps = {
  datasource_type: 'table',
  actions: {},
  controls: defaultControls,
  form_data: getFormDataFromControls(defaultControls),
  isDatasourceMetaLoading: false,
  exploreState: {},
};

describe('ControlPanelsContainer', () => {
  let wrapper;
  let scopedFilterOn = false;
  const isFeatureEnabledMock = jest.spyOn(featureFlags, 'isFeatureEnabled')
      .mockImplementation(() => scopedFilterOn);

  afterAll(() => {
    isFeatureEnabledMock.mockRestore();
  });

  it('renders ControlPanelSections', () => {
    wrapper = shallow(<ControlPanelsContainer {...defaultProps} />);
    expect(wrapper.find(ControlPanelSection)).toHaveLength(6);
  });

  it('renders filter panel when SCOPED_FILTER flag is on', () => {
    scopedFilterOn = true;
    wrapper = shallow(<ControlPanelsContainer {...defaultProps} />);
    expect(wrapper.find(ControlPanelSection)).toHaveLength(7);
  });
});
