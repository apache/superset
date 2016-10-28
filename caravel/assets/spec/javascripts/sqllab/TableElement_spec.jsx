import React from 'react';
import Link from '../../../javascripts/SqlLab/components/Link';
import TableElement from '../../../javascripts/SqlLab/components/TableElement';
import { table } from './fixtures';
import { mount, shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('TableElement', () => {
  const mockedProps = {
    table,
  };
  it('renders', () => {
    expect(
      React.isValidElement(<TableElement />)
    ).to.equal(true);
  });
  it('renders with props', () => {
    expect(
      React.isValidElement(<TableElement {...mockedProps} />)
    ).to.equal(true);
  });
  it('has 3 Link elements', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find(Link)).to.have.length(3);
  });
  it('has 14 columns', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find('div.table-column')).to.have.length(14);
  });
  it('mounts', () => {
    mount(<TableElement {...mockedProps} />);
  });
  it('sorts columns', () => {
    const wrapper = mount(<TableElement {...mockedProps} />);
    expect(wrapper.state().sortColumns).to.equal(false);
    expect(wrapper.find('.col-name').first().text()).to.equal('id');
    wrapper.find('.sort-cols').simulate('click');
    expect(wrapper.state().sortColumns).to.equal(true);
    expect(wrapper.find('.col-name').first().text()).to.equal('last_login');
  });
});
