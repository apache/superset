import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';

import DisplayQueryButton from '../../../../javascripts/explore/components/DisplayQueryButton';

describe('DisplayQueryButton', () => {
  const defaultProps = {
    slice: {
      viewSqlQuery: 'sql query string',
    },
  };

  it('renders', () => {
    expect(React.isValidElement(<DisplayQueryButton {...defaultProps} />)).to.equal(true);
  });
});
