import React from 'react';

import CopyToClipboard from '../../../src/components/CopyToClipboard';

describe('CopyToClipboard', () => {
  const defaultProps = {
    text: 'some text to copy',
  };

  it('renders', () => {
    expect(
      React.isValidElement(<CopyToClipboard {...defaultProps} />),
    ).toBe(true);
  });
});
