import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Panel } from 'react-bootstrap';

import {
  ControlPanelsContainer,
} from '../../../../javascripts/explorev2/components/ControlPanelsContainer';

const defaultProps = {
  viz_type: 'dist_bar',
  datasource_id: 1,
  datasource_type: 'type',
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
