import React from 'react';
import { initialState } from './fixtures';

import CopyQueryTabUrl from '../../../src/SqlLab/components/CopyQueryTabUrl';

describe('CopyQueryTabUrl', () => {
  const mockedProps = {
    queryEditor: initialState.sqlLab.queryEditors[0],
  };
  it('is valid with props', () => {
    expect(
      React.isValidElement(<CopyQueryTabUrl {...mockedProps} />),
    ).toBe(true);
  });
});
