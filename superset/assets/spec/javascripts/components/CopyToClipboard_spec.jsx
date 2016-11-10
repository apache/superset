import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';

import CopyToClipboard from '../../../javascripts/components/CopyToClipboard';

describe('CopyToClipboard', () => {
  const defaultProps = {
    text: 'some text to copy',
  };

  it('renders', () => {
    expect(
      React.isValidElement(<CopyToClipboard {...defaultProps} />)
    ).to.equal(true);
  });
});
