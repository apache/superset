import React from 'react';
import FaveQueries from '../../../javascripts/SqlLab/components/FaveQueries';
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('FaveQueries', () => {
  const mockedProps = {
    actions: {},
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<FaveQueries {...mockedProps} />)
    ).to.equal(true);
  });
});
