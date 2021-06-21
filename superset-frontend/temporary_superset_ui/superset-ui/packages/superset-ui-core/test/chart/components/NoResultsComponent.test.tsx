import React from 'react';
import { shallow } from 'enzyme';
import NoResultsComponent from '@superset-ui/core/src/chart/components/NoResultsComponent';
import { configure } from '@superset-ui/core/src';

configure();

describe('NoResultsComponent', () => {
  it('renders the no results error', () => {
    const wrapper = shallow(<NoResultsComponent height="400" width="300" />);

    expect(wrapper.text()).toEqual(
      'No ResultsNo results were returned for this query. If you expected results to be returned, ensure any filters are configured properly and the datasource contains data for the selected time range.',
    );
  });
});
