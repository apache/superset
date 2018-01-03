import React from 'react';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import DashboardTable from '../../../javascripts/welcome/DashboardTable';

const $ = window.$ = require('jquery');


describe('DashboardTable', () => {
  const mockedProps = {};
  let stub;
  beforeEach(() => {
    stub = sinon.stub($, 'getJSON');
  });
  afterEach(() => {
    stub.restore();
  });

  it('is valid', () => {
    expect(
      React.isValidElement(<DashboardTable {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders', () => {
    const wrapper = mount(<DashboardTable {...mockedProps} />);
    expect(stub.callCount).to.equal(1);
    expect(wrapper.find('img')).to.have.length(1);
  });
});
