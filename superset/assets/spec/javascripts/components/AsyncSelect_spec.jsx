import React from 'react';
import Select from 'react-select';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import $ from 'jquery';

import AsyncSelect from '../../../javascripts/components/AsyncSelect';

describe('AsyncSelect', () => {
  const mockedProps = {
    dataEndpoint: '/slicemodelview/api/read',
    onChange: sinon.spy(),
    mutator: () => [
      { value: 1, label: 'main' },
      { value: 2, label: 'another' },
    ],
  };
  it('is valid element', () => {
    expect(
      React.isValidElement(<AsyncSelect {...mockedProps} />),
    ).to.equal(true);
  });

  it('has one select', () => {
    const wrapper = shallow(
      <AsyncSelect {...mockedProps} />,
    );
    expect(wrapper.find(Select)).to.have.length(1);
  });

  it('calls onChange on select change', () => {
    const wrapper = shallow(
      <AsyncSelect {...mockedProps} />,
    );
    wrapper.find(Select).simulate('change', { value: 1 });
    expect(mockedProps.onChange).to.have.property('callCount', 1);
  });

  describe('auto select', () => {
    let stub;
    beforeEach(() => {
      stub = sinon.stub($, 'get');
      stub.yields();
    });
    afterEach(() => {
      stub.restore();
    });
    it('should be off by default', () => {
      const wrapper = shallow(
        <AsyncSelect {...mockedProps} />,
      );
      const spy = sinon.spy(wrapper.instance(), 'onChange');

      wrapper.instance().fetchOptions();
      expect(spy.callCount).to.equal(0);
    });
    it('should auto select first option', () => {
      const wrapper = shallow(
        <AsyncSelect {...mockedProps} autoSelect />,
      );
      const spy = sinon.spy(wrapper.instance(), 'onChange');

      wrapper.instance().fetchOptions();
      expect(spy.calledWith(wrapper.instance().state.options[0])).to.equal(true);
    });
  });
});
