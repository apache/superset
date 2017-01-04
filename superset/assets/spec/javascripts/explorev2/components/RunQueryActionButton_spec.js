import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';

import RunQueryActionButton
  from '../../../../javascripts/SqlLab/components/RunQueryActionButton';
import Button from '../../../../javascripts/components/Button';

describe('RunQueryActionButton', () => {
  let wrapper;
  const defaultProps = {
    allowAsync: false,
    dbId: 1,
    queryState: 'pending',
    runQuery: () => {}, // eslint-disable-line
    selectedText: null,
    stopQuery: () => {}, // eslint-disable-line
  };

  beforeEach(() => {
    wrapper = shallow(<RunQueryActionButton {...defaultProps} />);
  });

  it('is a valid react element', () => {
    expect(
      React.isValidElement(<RunQueryActionButton {...defaultProps} />)
    ).to.equal(true);
  });

  it('renders a single Button', () => {
    expect(wrapper.find(Button)).to.have.lengthOf(1);
  });
});
