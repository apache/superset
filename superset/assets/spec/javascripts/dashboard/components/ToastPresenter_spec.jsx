import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import mockMessageToasts from '../fixtures/mockMessageToasts';
import Toast from '../../../../src/dashboard/components/Toast';
import ToastPresenter from '../../../../src/dashboard/components/ToastPresenter';

describe('ToastPresenter', () => {
  const props = {
    toasts: mockMessageToasts,
    removeToast() {},
  };

  function setup(overrideProps) {
    const wrapper = shallow(<ToastPresenter {...props} {...overrideProps} />);
    return wrapper;
  }

  it('should render a div with class toast-presenter', () => {
    const wrapper = setup();
    expect(wrapper.find('.toast-presenter')).to.have.length(1);
  });

  it('should render a Toast for each toast object', () => {
    const wrapper = setup();
    expect(wrapper.find(Toast)).to.have.length(props.toasts.length);
  });

  it('should pass removeToast to the Toast component', () => {
    const removeToast = () => {};
    const wrapper = setup({ removeToast });
    expect(
      wrapper
        .find(Toast)
        .first()
        .prop('onCloseToast'),
    ).to.equal(removeToast);
  });
});
