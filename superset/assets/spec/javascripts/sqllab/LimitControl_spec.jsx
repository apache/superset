import React from 'react';
import { shallow } from 'enzyme';

import { Label } from 'react-bootstrap';
import LimitControl from '../../../src/SqlLab/components/LimitControl';
import ControlHeader from '../../../src/explore/components/ControlHeader';

describe('LimitControl', () => {
  const defaultProps = {
    value: 0,
    defaultQueryLimit: 1000,
    maxRow: 100000,
    onChange: () => {},
  };
  let wrapper;
  const factory = o => <LimitControl {...o} />;
  beforeEach(() => {
    wrapper = shallow(factory(defaultProps));
  });
  it('is a valid element', () => {
    expect(React.isValidElement(<LimitControl {...defaultProps} />)).toEqual(true);
  });
  it('renders a Label', () => {
    expect(wrapper.find(Label)).toHaveLength(1);
  });
  it('loads the correct state', () => {
    const value = 100;
    wrapper = shallow(factory({ ...defaultProps, value }));
    expect(wrapper.state().textValue).toEqual(value.toString());
    wrapper.find(Label).first().simulate('click');
    expect(wrapper.state().showOverlay).toBe(true);
    expect(wrapper.find(ControlHeader).props().validationErrors).toHaveLength(0);
  });
  it('handles invalid value', () => {
    wrapper.find(Label).first().simulate('click');
    wrapper.setState({ textValue: 'invalid' });
    expect(wrapper.find(ControlHeader).props().validationErrors).toHaveLength(1);
  });
  it('handles negative value', () => {
    wrapper.find(Label).first().simulate('click');
    wrapper.setState({ textValue: '-1' });
    expect(wrapper.find(ControlHeader).props().validationErrors).toHaveLength(1);
  });
  it('handles value above max row', () => {
    wrapper.find(Label).first().simulate('click');
    wrapper.setState({ textValue: (defaultProps.maxRow + 1).toString() });
    expect(wrapper.find(ControlHeader).props().validationErrors).toHaveLength(1);
  });
  it('opens and closes', () => {
    wrapper.find(Label).first().simulate('click');
    expect(wrapper.state().showOverlay).toBe(true);
    wrapper.find('.ok').first().simulate('click');
    expect(wrapper.state().showOverlay).toBe(false);
  });
  it('resets and closes', () => {
    const value = 100;
    wrapper = shallow(factory({ ...defaultProps, value }));
    wrapper.find(Label).first().simulate('click');
    expect(wrapper.state().textValue).toEqual(value.toString());
    wrapper.find('.reset').simulate('click');
    expect(wrapper.state().textValue).toEqual(defaultProps.defaultQueryLimit.toString());
  });
});
