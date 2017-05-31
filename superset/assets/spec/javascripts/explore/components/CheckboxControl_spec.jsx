/* eslint-disable no-unused-expressions */
import React from 'react';
import { Checkbox } from 'react-bootstrap';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { mount } from 'enzyme';

import CheckboxControl from '../../../../javascripts/explore/components/controls/CheckboxControl';

const defaultProps = {
  name: 'show_legend',
  onChange: sinon.spy(),
  value: false,
};

describe('CheckboxControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(<CheckboxControl {...defaultProps} />);
  });

  it('renders a Checkbox', () => {
    expect(wrapper.find(Checkbox)).to.have.lengthOf(1);
  });
});
