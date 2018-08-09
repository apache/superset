import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';

import CollectionTable from '../../../src/CRUD/CollectionTable';
import mockDatasource from '../../fixtures/mockDatasource';

const props = {
  collection: mockDatasource['7__table'].columns,
  tableColumns: ['column_name', 'type', 'groupby'],
};

describe('CollectionTable', () => {

  let wrapper;
  let el;

  beforeEach(() => {
    el = <CollectionTable {...props} />;
    wrapper = shallow(el);
  });

  it('is valid', () => {
    expect(React.isValidElement(el)).to.equal(true);
  });

  it('renders a table', () => {
    const length = mockDatasource['7__table'].columns.length;
    expect(wrapper.find('table')).to.have.lengthOf(1);
    expect(wrapper.find('tbody tr.row')).to.have.lengthOf(length);
  });

});
