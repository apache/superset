import React from 'react';
import { Panel, Row, Tab } from 'react-bootstrap';
import { shallow } from 'enzyme';

import Welcome from '../../../src/welcome/Welcome';

describe('Welcome', () => {
  const mockedProps = {};
  it('is valid', () => {
    expect(
      React.isValidElement(<Welcome {...mockedProps} />),
    ).toBe(true);
  });
  it('renders 4 Tab, Panel, and Row components', () => {
    const wrapper = shallow(<Welcome {...mockedProps} />);
    expect(wrapper.find(Tab)).toHaveLength(3);
    expect(wrapper.find(Panel)).toHaveLength(3);
    expect(wrapper.find(Row)).toHaveLength(3);
  });
});
