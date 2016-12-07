import React from 'react';
import CreatedContent from '../../../javascripts/profile/components/CreatedContent';
import TableLoader from '../../../javascripts/profile/components/TableLoader';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { user } from './fixtures';


describe('CreatedContent', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<CreatedContent {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders 2 TableLoader', () => {
    const wrapper = mount(<CreatedContent {...mockedProps} />);
    expect(wrapper.find(TableLoader)).to.have.length(2);
  });
  it('renders 2 titles', () => {
    const wrapper = mount(<CreatedContent {...mockedProps} />);
    expect(wrapper.find('h3')).to.have.length(2);
  });
});
