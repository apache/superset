import React from 'react';
import Select from 'react-select';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import AsyncSelect from '../../../src/components/AsyncSelect';

describe('AsyncSelect', () => {
  const mockedProps = {
    dataEndpoint: '/chart/api/read',
    onChange: sinon.spy(),
    placeholder: 'Select...',
    mutator: () => [
      { value: 1, label: 'main' },
      { value: 2, label: 'another' },
    ],
    valueRenderer: opt => opt.label,
  };
  it('is valid element', () => {
    expect(
      React.isValidElement(<AsyncSelect {...mockedProps} />),
    ).toBe(true);
  });

  it('has one select', () => {
    const wrapper = shallow(
      <AsyncSelect {...mockedProps} />,
    );
    expect(wrapper.find(Select)).toHaveLength(1);
  });

  it('calls onChange on select change', () => {
    const wrapper = shallow(
      <AsyncSelect {...mockedProps} />,
    );
    wrapper.find(Select).simulate('change', { value: 1 });
    expect(mockedProps.onChange).toHaveProperty('callCount', 1);
  });

  describe('auto select', () => {
    let server;
    beforeEach(() => {
      server = sinon.fakeServer.create();
      server.respondWith([
        200, { 'Content-Type': 'application/json' }, JSON.stringify({}),
      ]);
    });
    afterEach(() => {
      server.restore();
    });
    it('should be off by default', () => {
      const wrapper = shallow(
        <AsyncSelect {...mockedProps} />,
      );
      wrapper.instance().fetchOptions();
      const spy = sinon.spy(wrapper.instance(), 'onChange');
      expect(spy.callCount).toBe(0);
    });
    it('should auto select first option', () => {
      const wrapper = shallow(
        <AsyncSelect {...mockedProps} autoSelect />,
      );
      const spy = sinon.spy(wrapper.instance(), 'onChange');
      server.respond();

      expect(spy.callCount).toBe(1);
      expect(spy.calledWith(wrapper.instance().state.options[0])).toBe(true);
    });
    it('should not auto select when value prop is set', () => {
      const wrapper = shallow(
        <AsyncSelect {...mockedProps} value={2} autoSelect />,
      );
      const spy = sinon.spy(wrapper.instance(), 'onChange');
      wrapper.instance().fetchOptions();
      server.respond();

      expect(spy.callCount).toBe(0);
      expect(wrapper.find(Select)).toHaveLength(1);
    });
  });
});
