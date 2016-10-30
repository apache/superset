import React from 'react';
import CopyQueryTabUrl from '../../../javascripts/SqlLab/components/CopyQueryTabUrl';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { initialState } from './fixtures';

describe('CopyQueryTabUrl', () => {
  const mockedProps = {
    queryEditor: initialState.queryEditors[0],
  };
  it('is valid with props', () => {
    expect(
      React.isValidElement(<CopyQueryTabUrl {...mockedProps} />)
    ).to.equal(true);
  });
});
