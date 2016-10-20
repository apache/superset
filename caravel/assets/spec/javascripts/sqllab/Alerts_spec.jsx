import React from 'react';
import ReactDOM from 'react-dom';
import Alerts from '../../../javascripts/SqlLab/components/Alerts';
import { Alert } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { alert } from './common';


describe('Alerts', () => {

  const mockedProps = {
    alerts: [alert],
  }
  it('should just render', () => {
    expect(React.isValidElement(<Alerts>TEST</Alerts>)).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<Alerts {...mockedProps}k>TEST</Alerts>)
    ).to.equal(true);
  });
  it('has an anchor tag', () => {
    const wrapper = shallow(<Alerts {...mockedProps} />);
    expect(wrapper.find(Alert)).to.have.length(1);
  });
});
