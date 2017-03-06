import React from 'react';
import Select from 'react-select';
import AsyncSelect from '../../../javascripts/components/AsyncSelect';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('AsyncSelect', () => {
  const mockedProps = {
    dataEndpoint: '/slicemodelview/api/read',
    onChange: sinon.spy(),
    mutator: () => {},
  };
  it('is valid element', () => {
    expect(
      React.isValidElement(<AsyncSelect {...mockedProps} />)
    ).to.equal(true);
  });

  it('has one select', () => {
    const wrapper = shallow(
      <AsyncSelect {...mockedProps} />
    );
    expect(wrapper.find(Select)).to.have.length(1);
  });

  it('calls onChange on select change', () => {
    const wrapper = shallow(
      <AsyncSelect {...mockedProps} />
    );
    wrapper.find(Select).simulate('change', { value: 1 });
    expect(mockedProps.onChange).to.have.property('callCount', 1);
  });
});
