import React from 'react';
import { Overlay, Popover, FormControl } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import SaveQuery from '../../../javascripts/SqlLab/components/SaveQuery';

describe('SavedQuery', () => {
  const mockedProps = {
    dbId: 1,
    schema: 'main',
    sql: 'SELECT * FROM t',
    defaultLabel: 'untitled',
    animation: false,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<SaveQuery />),
    ).to.equal(true);
  });
  it('is valid with props', () => {
    expect(
      React.isValidElement(<SaveQuery {...mockedProps} />),
    ).to.equal(true);
  });
  it('has an Overlay and a Popover', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    expect(wrapper.find(Overlay)).to.have.length(1);
    expect(wrapper.find(Popover)).to.have.length(1);
  });
  it('pops and hides', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    expect(wrapper.state().showSave).to.equal(false);
    wrapper.find('.toggleSave').simulate('click', { target: { value: 'test' } });
    expect(wrapper.state().showSave).to.equal(true);
    wrapper.find('.toggleSave').simulate('click', { target: { value: 'test' } });
    expect(wrapper.state().showSave).to.equal(false);
  });
  it('has a cancel button', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    expect(wrapper.find('.cancelQuery')).to.have.length(1);
  });
  it('has 2 FormControls', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    expect(wrapper.find(FormControl)).to.have.length(2);
  });
});
