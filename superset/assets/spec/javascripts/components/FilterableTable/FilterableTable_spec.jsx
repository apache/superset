import React from 'react';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import FilterableTable from '../../../../javascripts/components/FilterableTable/FilterableTable';

describe('FilterableTable', () => {
  it('is valid element', () => {
    expect(React.isValidElement(<FilterableTable />)).to.equal(true);
  });
});
