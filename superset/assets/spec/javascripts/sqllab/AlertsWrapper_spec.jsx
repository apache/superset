import React from 'react';
import AlertsWrapper from '../../../javascripts/SqlLab/components/AlertsWrapper';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('AlertsWrapper', () => {
  it('is valid', () => {
    expect(React.isValidElement(<AlertsWrapper />)).to.equal(true);
  });
});
