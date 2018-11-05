import React from 'react';
import { shallow } from 'enzyme';
import { Label } from 'react-bootstrap';

import TooltipWrapper from './../../../../src/components/TooltipWrapper';

import RowCountLabel from '../../../../src/explore/components/RowCountLabel';

describe('RowCountLabel', () => {
  const defaultProps = {
    rowcount: 51,
    limit: 100,
  };

  it('is valid', () => {
    expect(React.isValidElement(<RowCountLabel {...defaultProps} />)).toBe(true);
  });
  it('renders a Label and a TooltipWrapper', () => {
    const wrapper = shallow(<RowCountLabel {...defaultProps} />);
    expect(wrapper.find(Label)).toHaveLength(1);
    expect(wrapper.find(TooltipWrapper)).toHaveLength(1);
  });
  it('renders a danger when limit is reached', () => {
    const props = {
      rowcount: 100,
      limit: 100,
    };
    const wrapper = shallow(<RowCountLabel {...props} />);
    expect(wrapper.find(Label).first().props().bsStyle).toBe('danger');
  });
});
