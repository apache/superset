import React from 'react';
import VisualizeModal from '../../../javascripts/SqlLab/components/VisualizeModal';
import { queries } from './common';
import { Modal } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('VisualizeModal', () => {
  const mockedProps = {
    show: true,
    query: queries[0],
  };
  it('should just render', () => {
    expect(React.isValidElement(<VisualizeModal />)).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<VisualizeModal {...mockedProps} />)
    ).to.equal(true);
  });
  it('has a Modal', () => {
    const wrapper = shallow(<VisualizeModal {...mockedProps} />);
    expect(wrapper.find(Modal)).to.have.length(1);
  });
});
