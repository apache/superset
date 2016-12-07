import React from 'react';
import Security from '../../../javascripts/profile/components/Security';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { user, userNoPerms } from './fixtures';


describe('Security', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<Security {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders 2 role labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.roles').find('.label')).to.have.length(2);
  });
  it('renders 2 datasource labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.datasources').find('.label')).to.have.length(2);
  });
  it('renders 3 database labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.databases').find('.label')).to.have.length(3);
  });
  it('renders no permission label when empty', () => {
    const wrapper = mount(<Security user={userNoPerms} />);
    expect(wrapper.find('.datasources').find('.label')).to.have.length(0);
    expect(wrapper.find('.databases').find('.label')).to.have.length(0);
  });
});
