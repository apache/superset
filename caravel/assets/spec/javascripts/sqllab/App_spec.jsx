import React from 'react';
import ReactDOM from 'react-dom';
import App from '../../../javascripts/SqlLab/components/App';
import { Alert } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('App', () => {

  const mockedProps = {
  }
  it('should just render', () => {
    expect(React.isValidElement(<App />)).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<App {...mockedProps} />)
    ).to.equal(true);
  });
});
