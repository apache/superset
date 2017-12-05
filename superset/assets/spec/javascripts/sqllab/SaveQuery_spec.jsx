import React from 'react';
import { FormControl } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import SaveQuery from '../../../javascripts/SqlLab/components/SaveQuery';
import ModalTrigger from '../../../javascripts/components/ModalTrigger';

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
  it('has a ModalTrigger', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    expect(wrapper.find(ModalTrigger)).to.have.length(1);
  });
  it('has a cancel button', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    const modal = shallow(wrapper.instance().renderModalBody());
    expect(modal.find('.cancelQuery')).to.have.length(1);
  });
  it('has 2 FormControls', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    const modal = shallow(wrapper.instance().renderModalBody());
    expect(modal.find(FormControl)).to.have.length(2);
  });
});
