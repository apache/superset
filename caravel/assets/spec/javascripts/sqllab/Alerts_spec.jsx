import React from 'react';
import Alerts from '../../../javascripts/SqlLab/components/Alerts';
import { Alert } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { alert } from './fixtures';


describe('Alerts', () => {
  const mockedProps = {
    alerts: [alert],
  };
  it('renders', () => {
    expect(React.isValidElement(<Alerts>TEST</Alerts>)).to.equal(true);
  });
  it('renders with props', () => {
    expect(
      React.isValidElement(<Alerts {...mockedProps}>TEST</Alerts>)
    ).to.equal(true);
  });
  it('renders an Alert', () => {
    const wrapper = shallow(<Alerts {...mockedProps} />);
    expect(wrapper.find(Alert)).to.have.length(1);
  });
});
