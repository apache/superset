import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';

import EmbedCodeButton from '../../../../javascripts/explore/components/EmbedCodeButton';

describe('EmbedCodeButton', () => {
  const defaultProps = {
    slice: {
      data: {
        standalone_endpoint: 'endpoint_url',
      },
    },
  };

  it('renders', () => {
    expect(React.isValidElement(<EmbedCodeButton {...defaultProps} />)).to.equal(true);
  });
});
