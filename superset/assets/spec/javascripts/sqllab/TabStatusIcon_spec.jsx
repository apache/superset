import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import TabStatusIcon from '../../../src/SqlLab/components/TabStatusIcon';

function setup() {
  const onClose = sinon.spy();
  const wrapper = shallow(<TabStatusIcon onClose={onClose} tabState="running" />);
  return { wrapper, onClose };
}

describe('TabStatusIcon', () => {
  it('renders a circle without an x when hovered', () => {
    const { wrapper } = setup();
    expect(wrapper.find('div.circle')).to.have.length(1);
    expect(wrapper.text()).to.equal('');
  });

  it('renders a circle with an x when hovered', () => {
    const { wrapper } = setup();
    wrapper.simulate('mouseOver');
    expect(wrapper.find('div.circle')).to.have.length(1);
    expect(wrapper.text()).to.equal('×');
  });

  it('calls onClose from props when clicked', () => {
    const { wrapper, onClose } = setup();
    wrapper.simulate('click');
    // eslint-disable-next-line no-unused-expressions
    expect(onClose.calledOnce).to.be.true;
  });
});
