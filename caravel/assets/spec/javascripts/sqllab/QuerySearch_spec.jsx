import React from 'react';
import Select from 'react-select';
import { Button } from 'react-bootstrap';
import QuerySearch from '../../../javascripts/SqlLab/components/QuerySearch';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('QuerySearch', () => {
  const mockedProps = {
    actions: {},
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<QuerySearch {...mockedProps} />)
    ).to.equal(true);
  });
  const wrapper = shallow(<QuerySearch {...mockedProps} />);

  it('should have four Select', () => {
    expect(wrapper.find(Select)).to.have.length(4);
  });

  it('should update userId', () => {
    wrapper.find('[name="select-user"]')
      .simulate('change', { value: 1 });
    expect(wrapper.state().userId).to.equal(1);
  });

  it('should update from time', () => {
    wrapper.find('[name="select-from"]')
      .simulate('change', { value: 0 });
    expect(wrapper.state().from).to.equal(0);
  });

  it('should update to time', () => {
    wrapper.find('[name="select-to"]')
      .simulate('change', { value: 0 });
    expect(wrapper.state().to).to.equal(0);
  });

  it('should update status', () => {
    wrapper.find('[name="select-status"]')
      .simulate('change', { value: 'success' });
    expect(wrapper.state().status).to.equal('success');
  });

  it('should have one input for searchText', () => {
    expect(wrapper.find('input')).to.have.length(1);
  });

  it('should update search text', () => {
    wrapper.find('input').simulate('change', { target: { value: 'text' } });
    expect(wrapper.state().searchText).to.equal('text');
  });

  it('should have one Button', () => {
    expect(wrapper.find(Button)).to.have.length(1);
  });

  it('should refresh queries when clicked', () => {
    const search = sinon.spy(QuerySearch.prototype, 'refreshQueries');
    wrapper.find(Button).simulate('click');
    expect(search).to.have.been.called;
  });
});
