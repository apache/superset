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
    expect(wrapper.find(Link)).to.have.length(2);
  });
  it('has 14 columns', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find('div.table-column')).to.have.length(14);
  });
  it('mounts', () => {
    mount(<TableElement {...mockedProps} />);
  });
});
