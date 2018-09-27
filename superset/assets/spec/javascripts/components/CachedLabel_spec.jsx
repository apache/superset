import React from 'react';
import { expect } from 'chai';
import { shallow } from 'enzyme';
import { Label } from 'react-bootstrap';

import CachedLabel from '../../../src/components/CachedLabel';

describe('CachedLabel', () => {
  const defaultProps = {
    onClick: () => {},
    cachedTimestamp: '2017-01-01',
  };

  it('is valid', () => {
    expect(
      React.isValidElement(<CachedLabel {...defaultProps} />),
    ).to.equal(true);
  });
  it('renders', () => {
    const wrapper = shallow(
      <CachedLabel {...defaultProps} />,
    );
    expect(wrapper.find(Label)).to.have.length(1);
  });
});
