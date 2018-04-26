import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { getFormDataFromControls, defaultControls }
  from '../../../../src/explore/store';
import {
  ControlPanelsContainer,
} from '../../../../src/explore/components/ControlPanelsContainer';
import ControlPanelSection from '../../../../src/explore/components/ControlPanelSection';

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

  beforeEach(() => {
    wrapper = shallow(<ControlPanelsContainer {...defaultProps} />);
  });

  it('renders ControlPanelSections', () => {
    expect(wrapper.find(ControlPanelSection)).to.have.lengthOf(7);
  });
});
