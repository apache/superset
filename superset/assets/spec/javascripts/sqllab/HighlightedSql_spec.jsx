import React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { mount, shallow } from 'enzyme';

import HighlightedSql from '../../../src/SqlLab/components/HighlightedSql';
import ModalTrigger from '../../../src/components/ModalTrigger';


describe('HighlightedSql', () => {
  const sql = "SELECT * FROM test WHERE something='fkldasjfklajdslfkjadlskfjkldasjfkladsjfkdjsa'";
  it('renders with props', () => {
    expect(React.isValidElement(<HighlightedSql sql={sql} />)).toBe(true);
  });
  it('renders a ModalTrigger', () => {
    const wrapper = shallow(<HighlightedSql sql={sql} />);
    expect(wrapper.find(ModalTrigger)).toHaveLength(1);
  });
  it('renders a ModalTrigger while using shrink', () => {
    const wrapper = shallow(<HighlightedSql sql={sql} shrink maxWidth={20} />);
    expect(wrapper.find(ModalTrigger)).toHaveLength(1);
  });
  it('renders two SyntaxHighlighter in modal', () => {
    const wrapper = mount(
      <HighlightedSql sql={sql} rawSql="SELECT * FORM foo" shrink maxWidth={5} />);
    const pre = wrapper.find('pre');
    expect(pre).toHaveLength(1);
    pre.simulate('click');
    setTimeout(() => {
      const modalBody = mount(wrapper.state().modalBody);
      expect(modalBody.find(SyntaxHighlighter)).toHaveLength(2);
    }, 10);
  });
});
