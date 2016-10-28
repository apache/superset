import React from 'react';
import App from '../../../javascripts/SqlLab/components/App';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('App', () => {
  it('is valid', () => {
    expect(React.isValidElement(<App />)).to.equal(true);
  });
});
