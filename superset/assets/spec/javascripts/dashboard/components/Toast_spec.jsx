import { Alert } from 'react-bootstrap';
import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import { INFO_TOAST } from '../../../../src/dashboard/util/constants';
import Toast from '../../../../src/dashboard/components/Toast';

describe('Toast', () => {
  const props = {
    toast: { id: 'id', toastType: INFO_TOAST, text: 'imma toast!' },
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

    expect(alert.childAt(1).text()).to.equal('imma toast!');
  });

  it('should call onCloseToast upon alert dismissal', done => {
    const onCloseToast = id => {
      expect(id).to.equal('id');
      done();
    };
    const wrapper = setup({ onCloseToast });
    const handleClosePress = wrapper.instance().handleClosePress;
    expect(wrapper.find(Alert).prop('onDismiss')).to.equal(handleClosePress);
    handleClosePress(); // there is a timeout for onCloseToast to be called
  });
});
