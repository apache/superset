import React from 'react';
import Select from 'react-select';
import { DatabaseSelect } from '../../../javascripts/SqlLab/components/DatabaseSelect';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('DatabaseSelect', () => {
  it('should render', () => {
    const wrapper = shallow(<DatabaseSelect />);
    expect(
      React.isValidElement(<DatabaseSelect />)
    ).to.equal(true);
  });

  it('should call onChange', () => {
    const onChange = sinon.spy();
    const wrapper = shallow(
      <DatabaseSelect onChange={onChange} />
    );
    wrapper.find(Select).simulate('change', { value: 1 });
    expect(onChange).to.have.property('callCount', 1);
  });
});
