import React from 'react';
import { mount } from 'enzyme';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import $ from 'jquery';

import Controls from '../../../javascripts/dashboard/components/Controls';
import { dashboardData } from './fixtures';

describe('Controls', () => {
  let wrapper;
  let ajaxStub;
  const mockedProps = {
    dashboard: dashboardData,
  };
  mockedProps.dashboard.css = 'foo';

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax');
    wrapper = mount(<Controls {...mockedProps} />);
  });

  afterEach(() => {
    ajaxStub.restore();
  });

  it('is a valid element', () => {
    expect(React.isValidElement(<Controls {...mockedProps} />)).to.equal(true);
  });

  it('sets the state to cssTemplates on componentWillMount', () => {
    ajaxStub.yieldsTo('success', {
      result: [{
        template_name: 'Test1',
        css: 'Test2',
      }],
    });

    const wrapper2 = mount(<Controls {...mockedProps} />);

    expect(wrapper2.state().css).to.equal('foo');
    expect(wrapper2.state().cssTemplates[0].value).to.equal('Test1');
    expect(wrapper2.state().cssTemplates[0].css).to.equal('Test2');
    expect(wrapper2.state().cssTemplates[0].label).to.equal('Test1');
  });

  it('renders all of the buttons', () => {
    expect(wrapper.find('button').nodes.length).to.equal(8);

    const buttons = ['refresh', 'plus', 'clock-o', 'filter', 'css3', 'envelope', 'edit', 'save'];
    let className;
    buttons.forEach((button) => {
      className = 'fa fa-' + button;
      expect(wrapper.contains(<i className={className} />)).to.equal(true);
    });
  });

  it('changeCSS changes the CSS', () => {
    expect(wrapper.state().css).to.equal('foo');
    wrapper.component.getInstance().changeCss('bar');
    expect(wrapper.state().css).to.equal('bar');
  });
});
