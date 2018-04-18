import React from 'react';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { shallow } from 'enzyme';
import AlertContainer from 'react-alert';
import AlertsWrapper from '../../../src/components/AlertsWrapper';

describe('AlertsWrapper', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<AlertsWrapper />);
  });

  it('is valid', () => {
    expect(React.isValidElement(<AlertsWrapper />)).to.equal(true);
  });

  it('renders AlertContainer', () => {
    expect(wrapper.find(AlertContainer)).to.have.length(1);
  });

  it('expects AlertContainer to have correct props', () => {
    const alertContainerProps = wrapper.find(AlertContainer).props();
    expect(alertContainerProps.offset).to.be.equal(14);
    expect(alertContainerProps.position).to.be.equal('top right');
    expect(alertContainerProps.theme).to.be.equal('dark');
    expect(alertContainerProps.time).to.be.equal(5000);
    expect(alertContainerProps.transition).to.be.equal('fade');
  });
});
