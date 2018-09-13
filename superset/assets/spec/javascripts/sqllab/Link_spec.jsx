import React from 'react';
import { shallow } from 'enzyme';
import { expect } from 'chai';

import Link from '../../../src/SqlLab/components/Link';

describe('Link', () => {
  const mockedProps = {
    tooltip: 'This is a tooltip',
    href: 'http://www.airbnb.com',
  };
  it('renders', () => {
    expect(React.isValidElement(<Link>TEST</Link>)).to.equal(true);
  });
  it('renders with props', () => {
    expect(
      React.isValidElement(<Link {...mockedProps} >TEST</Link>),
    ).to.equal(true);
  });
  it('renders an anchor tag', () => {
    const wrapper = shallow(<Link {...mockedProps} >TEST</Link>);
    expect(wrapper.find('a')).to.have.length(1);
  });
});
