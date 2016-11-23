import React from 'react';
import UserInfo from '../../../javascripts/profile/components/UserInfo';
import Gravatar from 'react-gravatar';
import { Panel } from 'react-bootstrap';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { user } from './fixtures';


describe('UserInfo', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<UserInfo {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders a Gravatar', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find(Gravatar)).to.have.length(1);
  });
  it('renders a Panel', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find(Panel)).to.have.length(1);
  });
  it('renders 5 icons', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find('i')).to.have.length(5);
  });
  it('renders roles information', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find('.roles').text()).to.equal(' Alpha, sql_lab');
  });
  it('shows the right user-id', () => {
    const wrapper = mount(<UserInfo {...mockedProps} />);
    expect(wrapper.find('.user-id').text()).to.equal('5');
  });
});
