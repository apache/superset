import React from 'react';
import { Panel, Col, Row, Tab } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

const $ = window.$ = require('jquery');

import App from '../../../javascripts/welcome/DashboardTable';

describe('DashboardTable', () => {
  const mockedProps = {};
  let ajaxStub;
  beforeEach(() => {
    //dispatch = sinon.spy();
    ajaxStub = sinon.stub($, 'ajax');
  });
  afterEach(() => {
    ajaxStub.restore();
  });

  it('is valid', () => {
    expect(
      React.isValidElement(<App {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders', () => {
    const wrapper = shallow(<App {...mockedProps} />);
    expect(ajaxStub.callCount).to.equal(1);
  });
});
