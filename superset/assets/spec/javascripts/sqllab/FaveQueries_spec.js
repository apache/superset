import React from 'react';
import Select from 'react-select';
import FaveQueries from '../../../javascripts/SqlLab/components/FaveQueries';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('QuerySearch', () => {
  const mockedProps = {
    actions: {},
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<FaveQueries {...mockedProps} />)
    ).to.equal(true);
  });
});
