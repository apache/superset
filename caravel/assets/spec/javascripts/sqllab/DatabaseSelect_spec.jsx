import React from 'react';
import Select from 'react-select';
import DatabaseSelect from '../../../javascripts/SqlLab/components/DatabaseSelect';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('DatabaseSelect', () => {
  const mockedProps = {
    actions: {},
  };
  it('is valid element', () => {
    expect(
      React.isValidElement(<DatabaseSelect {...mockedProps} />)
    ).to.equal(true);
  });

  it('has one select', () => {
    const wrapper = shallow(
      <DatabaseSelect {...mockedProps} />
    );
    expect(wrapper.find(Select)).to.have.length(1);
  });

  it('calls onChange on select change', () => {
    const onChange = sinon.spy();
    const wrapper = shallow(
      <DatabaseSelect onChange={onChange} />
    );
    wrapper.find(Select).simulate('change', { value: 1 });
    expect(onChange).to.have.property('callCount', 1);
  });
});
