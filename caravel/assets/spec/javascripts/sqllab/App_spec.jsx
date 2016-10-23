import React from 'react';
import App from '../../../javascripts/SqlLab/components/App';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('App', () => {
  const mockedProps = {
  };
  it('should just render', () => {
    expect(React.isValidElement(<App />)).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<App {...mockedProps} />)
    ).to.equal(true);
  });
});
