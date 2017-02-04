import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Panel } from 'react-bootstrap';
import { defaultFormData, initialState } from '../../../../javascripts/explorev2/stores/store';

import {
  ControlPanelsContainer,
} from '../../../../javascripts/explorev2/components/ControlPanelsContainer';
import { fields } from '../../../../javascripts/explorev2/stores/fields';

const defaultProps = {
  datasource_id: 1,
  datasource_type: 'type',
  exploreState: initialState(),
  form_data: defaultFormData(),
  fields,
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
