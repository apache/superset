import React from 'react';
import ColumnElement from '../../../javascripts/SqlLab/components/ColumnElement';
import { mockedActions, table } from './fixtures';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('ColumnElement', () => {
  const mockedProps = {
    actions: mockedActions,
    column: table.columns[0],
  };
  it('is valid with props', () => {
    expect(
      React.isValidElement(<ColumnElement {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders a proper primary key', () => {
    const wrapper = mount(<ColumnElement column={table.columns[0]} />);
    expect(wrapper.find('i.fa-key')).to.have.length(1);
    expect(wrapper.find('.col-name').first().text()).to.equal('id');
  });
  it('renders a multi-key column', () => {
    const wrapper = mount(<ColumnElement column={table.columns[1]} />);
    expect(wrapper.find('i.fa-link')).to.have.length(1);
    expect(wrapper.find('i.fa-bookmark')).to.have.length(1);
    expect(wrapper.find('.col-name').first().text()).to.equal('first_name');
  });
  it('renders a column with no keys', () => {
    const wrapper = mount(<ColumnElement column={table.columns[2]} />);
    expect(wrapper.find('i')).to.have.length(0);
    expect(wrapper.find('.col-name').first().text()).to.equal('last_name');
  });
});
