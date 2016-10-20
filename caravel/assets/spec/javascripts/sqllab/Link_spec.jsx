import React from 'react';
import ReactDOM from 'react-dom';
import Link from '../../../javascripts/SqlLab/components/Link';
import { Button } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('Link', () => {

  const mockedProps = {
    'tooltip': 'This is a tooltip',
    'href': 'http://www.airbnb.com',
  }
  it('should just render', () => {
    expect(React.isValidElement(<Link>TEST</Link>)).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<Link {...mockedProps} >TEST</Link>)
    ).to.equal(true);
  });
  it('has an anchor tag', () => {
    const wrapper = shallow(<Link {...mockedProps} >TEST</Link>);
    expect(wrapper.find('a')).to.have.length(1);
  });
});
