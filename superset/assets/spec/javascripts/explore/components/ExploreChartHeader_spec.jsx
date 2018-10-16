import React from 'react';
import { shallow } from 'enzyme';

import ExploreChartHeader from '../../../../src/explore/components/ExploreChartHeader';
import ExploreActionButtons from '../../../../src/explore/components/ExploreActionButtons';
import EditableTitle from '../../../../src/components/EditableTitle';

const mockProps = {
  actions: {},
  can_overwrite: true,
  can_download: true,
  isStarred: true,
  slice: {},
  table_name: 'foo',
  form_data: {},
  timeout: 1000,
  chart: {
    queryResponse: {},
  },
};

describe('ExploreChartHeader', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = shallow(<ExploreChartHeader {...mockProps} />);
  });

  it('is valid', () => {
    expect(
      React.isValidElement(<ExploreChartHeader {...mockProps} />),
    ).toBe(true);
  });

  it('renders', () => {
    expect(wrapper.find(EditableTitle)).toHaveLength(1);
    expect(wrapper.find(ExploreActionButtons)).toHaveLength(1);
  });
});
