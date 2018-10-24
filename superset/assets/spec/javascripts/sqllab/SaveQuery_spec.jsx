import React from 'react';
import { FormControl } from 'react-bootstrap';
import { shallow } from 'enzyme';
import SaveQuery from '../../../src/SqlLab/components/SaveQuery';
import ModalTrigger from '../../../src/components/ModalTrigger';

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
    ).toBe(true);
  });
  it('is valid with props', () => {
    expect(
      React.isValidElement(<SaveQuery {...mockedProps} />),
    ).toBe(true);
  });
  it('has a ModalTrigger', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    expect(wrapper.find(ModalTrigger)).toHaveLength(1);
  });
  it('has a cancel button', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    const modal = shallow(wrapper.instance().renderModalBody());
    expect(modal.find('.cancelQuery')).toHaveLength(1);
  });
  it('has 2 FormControls', () => {
    const wrapper = shallow(<SaveQuery {...mockedProps} />);
    const modal = shallow(wrapper.instance().renderModalBody());
    expect(modal.find(FormControl)).toHaveLength(2);
  });
});
