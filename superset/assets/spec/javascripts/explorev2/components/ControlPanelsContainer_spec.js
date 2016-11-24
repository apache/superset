import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Panel } from 'react-bootstrap';
import { defaultFormData } from '../../../../javascripts/explorev2/stores/store';

import {
  ControlPanelsContainer,
} from '../../../../javascripts/explorev2/components/ControlPanelsContainer';

const defaultProps = {
  datasource_id: 1,
  datasource_type: 'type',
  form_data: defaultFormData(),
  actions: {
    fetchFieldOptions: () => {
      // noop
    },
  },
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
