import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';

import URLShortLinkButton from '../../../../javascripts/explore/components/URLShortLinkButton';

describe('URLShortLinkButton', () => {
  const defaultProps = {
    slice: {
      querystring: () => 'query string',
    },
  };

  it('renders', () => {
    expect(React.isValidElement(<URLShortLinkButton {...defaultProps} />)).to.equal(true);
  });
});
