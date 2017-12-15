import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { Label } from 'react-bootstrap';

import TooltipWrapper from './../../../../javascripts/components/TooltipWrapper';

import RowCountLabel from '../../../../javascripts/explore/components/RowCountLabel';

describe('RowCountLabel', () => {
  const defaultProps = {
    rowcount: 51,
    limit: 100,
  };

  it('is valid', () => {
    expect(React.isValidElement(<RowCountLabel {...defaultProps} />)).to.equal(true);
  });
  it('renders a Label and a TooltipWrapper', () => {
    const wrapper = shallow(<RowCountLabel {...defaultProps} />);
    expect(wrapper.find(Label)).to.have.lengthOf(1);
    expect(wrapper.find(TooltipWrapper)).to.have.lengthOf(1);
  });
  it('renders a warning when limit is reached', () => {
    const props = {
      rowcount: 100,
      limit: 100,
    };
    const wrapper = shallow(<RowCountLabel {...props} />);
    expect(wrapper.find(Label).first().props().bsStyle).to.equal('warning');
  });
});
