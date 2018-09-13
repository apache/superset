import { Alert } from 'react-bootstrap';
import React from 'react';
import { shallow } from 'enzyme';
import { expect } from 'chai';

import mockMessageToasts from '../mockMessageToasts';
import Toast from '../../../../src/messageToasts/components/Toast';

describe('Toast', () => {
  const props = {
    toast: mockMessageToasts[0],
    onCloseToast() {},
  };

  function setup(overrideProps) {
    const wrapper = shallow(<Toast {...props} {...overrideProps} />);
    return wrapper;
  }

  it('should render an Alert', () => {
    const wrapper = setup();
    expect(wrapper.find(Alert)).to.have.length(1);
  });

  it('should render toastText within the alert', () => {
    const wrapper = setup();
    const alert = wrapper.find(Alert).dive();

    expect(alert.childAt(1).text()).to.equal(props.toast.text);
  });

  it('should call onCloseToast upon alert dismissal', done => {
    const onCloseToast = id => {
      expect(id).to.equal(props.toast.id);
      done();
    };
    const wrapper = setup({ onCloseToast });
    const handleClosePress = wrapper.instance().handleClosePress;
    expect(wrapper.find(Alert).prop('onDismiss')).to.equal(handleClosePress);
    handleClosePress(); // there is a timeout for onCloseToast to be called
  });
});
