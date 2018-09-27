import React from 'react';
import { expect } from 'chai';
import { initialState } from './fixtures';

import CopyQueryTabUrl from '../../../src/SqlLab/components/CopyQueryTabUrl';

describe('CopyQueryTabUrl', () => {
  const mockedProps = {
    queryEditor: initialState.sqlLab.queryEditors[0],
  };
  it('is valid with props', () => {
    expect(
      React.isValidElement(<CopyQueryTabUrl {...mockedProps} />),
    ).to.equal(true);
  });
});
