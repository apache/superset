import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';

import ExploreActionButtons from '../../../../javascripts/explore/components/ExploreActionButtons';

describe('ExploreActionButtons', () => {
  const defaultProps = {
    canDownload: 'True',
    slice: {},
  };

  it('renders', () => {
    expect(
      React.isValidElement(<ExploreActionButtons {...defaultProps} />)
    ).to.equal(true);
  });
});
