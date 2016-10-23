import React from 'react';
import SqlEditorLeftBar from '../../../javascripts/SqlLab/components/SqlEditorLeftBar';
import TableElement from '../../../javascripts/SqlLab/components/TableElement';
import { mount } from 'enzyme';
import { table, defaultQueryEditor } from './common';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('SqlEditorLeftBar', () => {
  const mockedProps = {
    tables: [table],
    queryEditor: defaultQueryEditor,
  };
  it('should just render', () => {
    expect(
      React.isValidElement(<SqlEditorLeftBar />)
    ).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<SqlEditorLeftBar {...mockedProps} />)
    ).to.equal(true);
  });
  it('has a TableElement', () => {
    const wrapper = mount(<SqlEditorLeftBar {...mockedProps} />);
    expect(wrapper.find(TableElement)).to.have.length(1);
  });
});
