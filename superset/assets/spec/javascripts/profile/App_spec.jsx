import React from 'react';
import { Col, Row, Tab } from 'react-bootstrap';
import { mount } from 'enzyme';
import { expect } from 'chai';

import { user } from './fixtures';
import App from '../../../src/profile/components/App';

describe('App', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<App {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders 2 Col', () => {
    const wrapper = mount(<App {...mockedProps} />);
    expect(wrapper.find(Row)).to.have.length(1);
    expect(wrapper.find(Col)).to.have.length(2);
  });
  it('renders 4 Tabs', () => {
    const wrapper = mount(<App {...mockedProps} />);
    expect(wrapper.find(Tab)).to.have.length(4);
  });
});
