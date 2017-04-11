import React from 'react';
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
});
