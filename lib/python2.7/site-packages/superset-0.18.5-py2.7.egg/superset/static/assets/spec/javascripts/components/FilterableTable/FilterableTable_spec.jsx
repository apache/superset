import React from 'react';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import FilterableTable from '../../../../javascripts/components/FilterableTable/FilterableTable';

describe('FilterableTable', () => {
  const mockedProps = {
    orderedColumnKeys: [],
    data: [],
    height: 0,
  };
  it('is valid element', () => {
    expect(React.isValidElement(<FilterableTable {...mockedProps} />)).to.equal(true);
  });
});
