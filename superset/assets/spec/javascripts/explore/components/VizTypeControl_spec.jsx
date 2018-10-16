import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { Modal } from 'react-bootstrap';
import VizTypeControl from '../../../../src/explore/components/controls/VizTypeControl';

const defaultProps = {
  name: 'viz_type',
  label: 'Visualization Type',
  value: 'table',
  onChange: sinon.spy(),
};

describe('VizTypeControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<VizTypeControl {...defaultProps} />);
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toHaveLength(1);
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find('.viztype-selector-container').first();
    select.simulate('click');
    expect(defaultProps.onChange.called).toBe(true);
  });
  it('filters images based on text input', () => {
    expect(wrapper.find('img').length).toBeGreaterThan(20);
    wrapper.setState({ filter: 'time' });
    expect(wrapper.find('img').length).toBeLessThan(10);
  });
});
