import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Panel } from 'react-bootstrap';
import { getFormDataFromFields, defaultFields }
  from '../../../../javascripts/explorev2/stores/store';
import {
  ControlPanelsContainer,
} from '../../../../javascripts/explorev2/components/ControlPanelsContainer';

const defaultProps = {
  datasource_type: 'table',
  actions: {},
  fields: defaultFields,
  form_data: getFormDataFromFields(defaultFields),
  isDatasourceMetaLoading: false,
  exploreState: {},
};

describe('ControlPanelsContainer', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<ControlPanelsContainer {...defaultProps} />);
  });

  it('renders a Panel', () => {
    expect(wrapper.find(Panel)).to.have.lengthOf(1);
  });
});
