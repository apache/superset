import React from 'react';
import { mount } from 'enzyme';
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

import Controls from '../../../javascripts/dashboard/components/Controls.jsx';
import { dashboardData } from './fixtures'

describe('Controls', () => {
	let wrapper;
	const mockedProps = {
		dashboard: dashboardData,
	};
	mockedProps.dashboard.css = 'foo';

	beforeEach(() => {
    wrapper = mount(<Controls {...mockedProps} />);
	});

  it('is a valid element', () => {
  	expect(React.isValidElement(<Controls {...mockedProps} />)).to.equal(true);
  });

  it('sets the state to cssTemplates on componentWillMount', () => {
  	expect(wrapper.state().css).to.equal('foo');
  });

  it('renders the buttons properly', () => {
  	expect(wrapper.find('button').nodes.length).to.equal(8); 
  });
});
