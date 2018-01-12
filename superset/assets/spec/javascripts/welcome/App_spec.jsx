import React from 'react';
import { Panel, Col, Row } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import App from '../../../javascripts/welcome/App';

describe('App', () => {
  const mockedProps = {};
  it('is valid', () => {
    expect(
      React.isValidElement(<App {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders 2 Col', () => {
    const wrapper = shallow(<App {...mockedProps} />);
    expect(wrapper.find(Panel)).to.have.length(1);
    expect(wrapper.find(Row)).to.have.length(1);
    expect(wrapper.find(Col)).to.have.length(2);
  });
});
