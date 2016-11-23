import React from 'react';
import Favorites from '../../../javascripts/profile/components/Favorites';
import TableLoader from '../../../javascripts/profile/components/TableLoader';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { user } from './fixtures';

describe('Favorites', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<Favorites {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders 2 TableLoader', () => {
    const wrapper = mount(<Favorites {...mockedProps} />);
    expect(wrapper.find(TableLoader)).to.have.length(2);
  });
  it('renders 2 titles', () => {
    const wrapper = mount(<Favorites {...mockedProps} />);
    expect(wrapper.find('h3')).to.have.length(2);
  });
});
