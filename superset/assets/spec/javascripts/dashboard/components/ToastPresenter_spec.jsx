import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import { INFO_TOAST } from '../../../../src/dashboard/util/constants';
import Toast from '../../../../src/dashboard/components/Toast';
import ToastPresenter from '../../../../src/dashboard/components/ToastPresenter';

describe('ToastPresenter', () => {
  const props = {
    toasts: [{ id: 'id', toastType: INFO_TOAST, text: 'imma toast!' }],
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
    expect(wrapper.find(Toast)).to.have.length(1);
  });

  it('should pass removeToast to the Toast component', () => {
    const removeToast = () => {};
    const wrapper = setup({ removeToast });
    expect(wrapper.find(Toast).prop('onCloseToast')).to.equal(removeToast);
  });
});
