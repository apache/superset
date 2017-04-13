import React from 'react';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import AlertsWrapper from '../../../javascripts/components/AlertsWrapper';

describe('AlertsWrapper', () => {
  it('is valid', () => {
    expect(React.isValidElement(<AlertsWrapper />)).to.equal(true);
  });
});
