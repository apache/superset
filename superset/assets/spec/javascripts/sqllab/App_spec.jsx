import React from 'react';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import App from '../../../javascripts/SqlLab/components/App';

describe('App', () => {
  it('is valid', () => {
    expect(React.isValidElement(<App />)).to.equal(true);
  });
});
