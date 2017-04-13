import React from 'react';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { initialState } from './fixtures';

import CopyQueryTabUrl from '../../../javascripts/SqlLab/components/CopyQueryTabUrl';

describe('CopyQueryTabUrl', () => {
  const mockedProps = {
    queryEditor: initialState.queryEditors[0],
  };
  it('is valid with props', () => {
    expect(
      React.isValidElement(<CopyQueryTabUrl {...mockedProps} />),
    ).to.equal(true);
  });
});
