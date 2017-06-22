import React from 'react';
import { Label } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import QueryStateLabel from '../../../javascripts/SqlLab/components/QueryStateLabel';

describe('SavedQuery', () => {
  const mockedProps = {
    query: {
      state: 'running',
    },
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<QueryStateLabel />),
    ).to.equal(true);
  });
  it('is valid with props', () => {
    expect(
      React.isValidElement(<QueryStateLabel {...mockedProps} />),
    ).to.equal(true);
  });
  it('has an Overlay and a Popover', () => {
    const wrapper = shallow(<QueryStateLabel {...mockedProps} />);
    expect(wrapper.find(Label)).to.have.length(1);
  });
});
