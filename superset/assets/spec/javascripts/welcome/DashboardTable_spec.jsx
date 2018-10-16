import React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';

import DashboardTable from '../../../src/welcome/DashboardTable';

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
    ).toBe(true);
  });
  it('renders', () => {
    const wrapper = mount(<DashboardTable {...mockedProps} />);
    expect(stub.callCount).toBe(1);
    expect(wrapper.find('img')).toHaveLength(1);
  });
});
