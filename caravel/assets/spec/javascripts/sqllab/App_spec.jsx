import React from 'react';
import App from '../../../javascripts/SqlLab/components/App';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('App', () => {
  const mockedProps = {
  };
  it('renders', () => {
    expect(React.isValidElement(<App />)).to.equal(true);
  });
  it('renders with props', () => {
    expect(
      React.isValidElement(<App {...mockedProps} />)
    ).to.equal(true);
  });
});
