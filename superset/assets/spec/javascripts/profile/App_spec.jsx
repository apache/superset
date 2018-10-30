import React from 'react';
import { Col, Row, Tab } from 'react-bootstrap';
import { shallow } from 'enzyme';

import { user } from './fixtures';
import App from '../../../src/profile/components/App';

describe('App', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<App {...mockedProps} />),
    ).toBe(true);
  });

  it('renders 2 Col', () => {
    const wrapper = shallow(<App {...mockedProps} />);
    expect(wrapper.find(Row)).toHaveLength(1);
    expect(wrapper.find(Col)).toHaveLength(2);
  });

  it('renders 4 Tabs', () => {
    const wrapper = shallow(<App {...mockedProps} />);
    expect(wrapper.find(Tab)).toHaveLength(4);
  });
});
