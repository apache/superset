import React from 'react';
<<<<<<< HEAD
=======
import ResultSet from '../../../javascripts/SqlLab/components/ResultSet';
import FilterableTable from '../../../javascripts/components/FilterableTable/FilterableTable';

>>>>>>> update name to FilterableTable
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import ResultSet from '../../../javascripts/SqlLab/components/ResultSet';
import FilterTable from '../../../javascripts/components/FilterTable';

describe('ResultSet', () => {
  const mockedProps = {
    query: queries[0],
  };
  it('is a valid component', () => {
    expect(React.isValidElement(<ResultSet />)).to.equal(true);
  });
<<<<<<< HEAD
=======
  it('renders with props', () => {
    expect(
      React.isValidElement(<ResultSet />)
    ).to.equal(true);
  });
  it('renders a Table', () => {
    const wrapper = shallow(<ResultSet {...mockedProps} />);
    expect(wrapper.find(FilterableTable)).to.have.length(1);
  });
>>>>>>> update name to FilterableTable
});
