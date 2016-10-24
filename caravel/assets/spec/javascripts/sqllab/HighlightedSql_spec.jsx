import React from 'react';
import HighlightedSql from '../../../javascripts/SqlLab/components/HighlightedSql';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('HighlightedSql', () => {
  const sql = "SELECT * FROM test WHERE something='fkldasjfklajdslfkjadlskfjkldasjfkladsjfkdjsa'";
  it('renders', () => {
    expect(React.isValidElement(<HighlightedSql />)).to.equal(true);
  });
  it('renders with props', () => {
    expect(React.isValidElement(<HighlightedSql sql={sql} />))
    .to.equal(true);
  });
  it('renders a SyntaxHighlighter', () => {
    const wrapper = shallow(<HighlightedSql sql={sql} />);
    expect(wrapper.find(SyntaxHighlighter)).to.have.length(1);
  });
  it('renders a SyntaxHighlighter while using shrink', () => {
    const wrapper = shallow(<HighlightedSql sql={sql} shrink maxWidth={20} />);
    expect(wrapper.find(SyntaxHighlighter)).to.have.length(1);
  });
});
