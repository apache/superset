import React from 'react';
import $ from 'jquery';
import { expect } from 'chai';
import { describe, it, before, beforeEach, afterEach } from 'mocha';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import FilterBox from '../../../src/visualizations/filter_box/FilterBox';
import OnPasteSelect from '../../../src/components/OnPasteSelect';

const defaultProps = {
  filtersChoices: {
    COUNTRY: [
      {
        filter: 'COUNTRY',
        text: 'USA',
        metric: 5713,
        id: 'USA',
      },
    ],
    STATE: [
      {
        filter: 'STATE',
        text: 'TX',
        metric: 2125,
        id: 'TX',
      },
      {
        filter: 'STATE',
        text: 'CA',
        metric: 2054,
        id: 'CA',
      },
    ],
    CITY: [
      {
        filter: 'CITY',
        text: 'Dallas-Fort Worth',
        metric: 856,
        id: 'Dallas-Fort Worth',
      },
      {
        filter: 'CITY',
        text: 'Los Angeles',
        metric: 789,
        id: 'Los Angeles',
      },
    ],
    AIRPORT: [
      {
        filter: 'AIRPORT',
        text: 'Dallas/Fort Worth International Airport',
        metric: 856,
        id: 'Dallas/Fort Worth International Airport',
      },
      {
        filter: 'AIRPORT',
        text: 'Los Angeles International Airport',
        metric: 789,
        id: 'Los Angeles International Airport',
      },
    ],
  },
  datasource: {
    verbose_map: {},
    type: 'table',
    id: 10,
  },
};

describe('FilterBox', () => {
  let wrapper;
  let defaultFilterOptions;
  let ajaxStub;

  function getFilterComponent(filter) {
    return wrapper.wrap(
      wrapper
      .find(OnPasteSelect)
      .getNodes()
      .filter(node => node.key.includes(filter))[0],
    );
  }

  function getFilterOptions(filter) {
    return getFilterComponent(filter).props().options.map(option => option.value);
  }

  before(() => {
    defaultFilterOptions = Object.assign({}, defaultProps.filtersChoices);
    for (const filter in defaultFilterOptions) {
      defaultFilterOptions[filter] = defaultFilterOptions[filter].map(value => value.id);
    }
  });

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax');
    wrapper = shallow(<FilterBox {...defaultProps} />);
  });

  afterEach(() => {
    ajaxStub.restore();
  });

  it('renders an OnPasteSelect for each filter', () => {
    const filterCount = Object.keys(defaultProps.filtersChoices).length;
    expect(wrapper.find(OnPasteSelect)).to.have.length(filterCount);
  });

  it('includes all options when cascadingFilterChoices is empty', () => {
    expect(Object.keys(wrapper.state().cascadingFilterChoices)).to.have.length(0);
    wrapper.find(OnPasteSelect).forEach((node) => {
      const filter = node.key();
      expect(getFilterOptions(filter)).to.deep.equal(defaultFilterOptions[filter]);
    });
  });

  it('filters options after filter selection in following filters but not preceding', () => {
    const airportValues = ['Los Angeles International Airport'];
    ajaxStub.yieldsTo('success', airportValues);

    const filter = 'CITY';
    const value = 'Los Angeles';
    const selectedValue = [{ value, label: value, style: {} }];
    const component = getFilterComponent(filter);
    component.simulate('change', selectedValue);

    expect(wrapper.state().selectedValues[filter]).to.include(value);

    expect(getFilterOptions('COUNTRY')).to.deep.equal(defaultFilterOptions.COUNTRY);
    expect(getFilterOptions('STATE')).to.deep.equal(defaultFilterOptions.STATE);
    expect(getFilterOptions('CITY')).to.deep.equal(defaultFilterOptions.CITY);

    expect(getFilterOptions('AIRPORT')).to.deep.equal(airportValues);
  });

  it('includes selected values contained in filtersChoices in options', () => {
    wrapper.setState({
      selectedValues: { STATE: ['CA'] },
      cascadingFilterChoices: { STATE: ['CA'] },
    });

    expect(getFilterOptions('STATE')).to.include('CA');
  });

  it('includes selected values not contained in filtersChoices in options', () => {
    wrapper.setState({
      selectedValues: { STATE: ['CA'] },
      cascadingFilterChoices: { STATE: ['TX'] },
    });

    expect(getFilterOptions('STATE')).to.include('CA');
    expect(getFilterOptions('STATE')).to.include('TX');
  });
});
