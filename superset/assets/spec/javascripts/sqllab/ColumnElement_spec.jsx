import React from 'react';
import { mount } from 'enzyme';

import { mockedActions, table } from './fixtures';
import ColumnElement from '../../../src/SqlLab/components/ColumnElement';


describe('ColumnElement', () => {
  const mockedProps = {
    actions: mockedActions,
    column: table.columns[0],
  };
  it('is valid with props', () => {
    expect(
      React.isValidElement(<ColumnElement {...mockedProps} />),
    ).toBe(true);
  });
  it('renders a proper primary key', () => {
    const wrapper = mount(<ColumnElement column={table.columns[0]} />);
    expect(wrapper.find('i.fa-key')).toHaveLength(1);
    expect(wrapper.find('.col-name').first().text()).toBe('id');
  });
  it('renders a multi-key column', () => {
    const wrapper = mount(<ColumnElement column={table.columns[1]} />);
    expect(wrapper.find('i.fa-link')).toHaveLength(1);
    expect(wrapper.find('i.fa-bookmark')).toHaveLength(1);
    expect(wrapper.find('.col-name').first().text()).toBe('first_name');
  });
  it('renders a column with no keys', () => {
    const wrapper = mount(<ColumnElement column={table.columns[2]} />);
    expect(wrapper.find('i')).toHaveLength(0);
    expect(wrapper.find('.col-name').first().text()).toBe('last_name');
  });
});
