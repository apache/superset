import React from 'react';
import { mount, shallow } from 'enzyme';

import Link from '../../../src/SqlLab/components/Link';
import TableElement from '../../../src/SqlLab/components/TableElement';
import ColumnElement from '../../../src/SqlLab/components/ColumnElement';
import { mockedActions, table } from './fixtures';

describe('TableElement', () => {
  const mockedProps = {
    actions: mockedActions,
    table,
    timeout: 0,
  };
  it('renders', () => {
    expect(
      React.isValidElement(<TableElement />),
    ).toBe(true);
  });
  it('renders with props', () => {
    expect(
      React.isValidElement(<TableElement {...mockedProps} />),
    ).toBe(true);
  });
  it('has 2 Link elements', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find(Link)).toHaveLength(2);
  });
  it('has 14 columns', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.find(ColumnElement)).toHaveLength(14);
  });
  it('mounts', () => {
    mount(<TableElement {...mockedProps} />);
  });
  it('sorts columns', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.state().sortColumns).toBe(false);
    expect(wrapper.find(ColumnElement).first().props().column.name).toBe('id');
    wrapper.find('.sort-cols').simulate('click');
    expect(wrapper.state().sortColumns).toBe(true);
    expect(wrapper.find(ColumnElement).first().props().column.name).toBe('last_login');
  });
  it('calls the collapseTable action', () => {
    const wrapper = mount(<TableElement {...mockedProps} />);
    expect(mockedActions.collapseTable.called).toBe(false);
    wrapper.find('.table-name').simulate('click');
    expect(mockedActions.collapseTable.called).toBe(true);
  });
  it('removes the table', () => {
    const wrapper = shallow(<TableElement {...mockedProps} />);
    expect(wrapper.state().expanded).toBe(true);
    wrapper.find('.table-remove').simulate('click');
    expect(wrapper.state().expanded).toBe(false);
    expect(mockedActions.removeDataPreview.called).toBe(true);
  });
});
