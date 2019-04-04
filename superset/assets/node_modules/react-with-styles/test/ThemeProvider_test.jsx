import React from 'react';
import { expect } from 'chai';
import { shallow } from 'enzyme';

import ThemeProvider from '../src/ThemeProvider';

describe('<ThemeProvider>', () => {
  it('renders its child', () => {
    const wrapper = shallow(
      <ThemeProvider name="tropical">
        <div>Under the sea</div>
      </ThemeProvider>,
    );
    expect(wrapper.find('div')).to.have.length(1);
  });

  it('defines context of its child', () => {
    const wrapper = shallow(
      <ThemeProvider name="tropical">
        <div>Under the sea</div>
      </ThemeProvider>,
    );
    expect(wrapper.instance().getChildContext())
      .to.have.property('themeName', 'tropical');
  });
});
