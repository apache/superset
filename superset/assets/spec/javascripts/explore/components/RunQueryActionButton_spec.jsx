import React from 'react';
import { shallow } from 'enzyme';

import RunQueryActionButton
  from '../../../../src/SqlLab/components/RunQueryActionButton';
import Button from '../../../../src/components/Button';

describe('RunQueryActionButton', () => {
  let wrapper;
  const defaultProps = {
    allowAsync: false,
    dbId: 1,
    queryState: 'pending',
    runQuery: () => {}, // eslint-disable-line
    selectedText: null,
    stopQuery: () => {}, // eslint-disable-line
    sql: '',
  };

  beforeEach(() => {
    wrapper = shallow(<RunQueryActionButton {...defaultProps} />);
  });

  it('is a valid react element', () => {
    expect(
      React.isValidElement(<RunQueryActionButton {...defaultProps} />),
    ).toBe(true);
  });

  it('renders a single Button', () => {
    expect(wrapper.find(Button)).toHaveLength(1);
  });
});
