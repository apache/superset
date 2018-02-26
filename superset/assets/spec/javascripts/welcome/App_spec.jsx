import React from 'react';
import { Panel, Row, Tab } from 'react-bootstrap';
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
  it('renders 4 Tab, Panel, and Row components', () => {
    const wrapper = shallow(<App {...mockedProps} />);
    expect(wrapper.find(Tab)).to.have.length(3);
    expect(wrapper.find(Panel)).to.have.length(3);
    expect(wrapper.find(Row)).to.have.length(3);
  });
});
