import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import { shallow } from 'enzyme';

import Checkbox from '../../../javascripts/components/Checkbox';

describe('Checkbox', () => {
  const defaultProps = {
    checked: true,
    onChange: sinon.spy(),
  };

  let wrapper;
  const factory = (o) => {
    const props = Object.assign({}, defaultProps, o);
    return shallow(<Checkbox {...props} />);
  };
  beforeEach(() => {
    wrapper = factory({});
  });
  it('is a valid element', () => {
    expect(React.isValidElement(<Checkbox {...defaultProps} />)).to.equal(true);
  });
  it('inits checked when checked', () => {
    expect(wrapper.find('i.fa-check.text-primary')).to.have.length(1);
  });
  it('inits unchecked when not checked', () => {
    const el = factory({ checked: false });
    expect(el.find('i.fa-check.text-primary')).to.have.length(0);
    expect(el.find('i.fa-check.text-transparent')).to.have.length(1);
  });
  it('unchecks when clicked', () => {
    expect(wrapper.find('i.fa-check.text-transparent')).to.have.length(0);
    wrapper.find('i').first().simulate('click');
    expect(defaultProps.onChange.calledOnce).to.equal(true);
  });
});
