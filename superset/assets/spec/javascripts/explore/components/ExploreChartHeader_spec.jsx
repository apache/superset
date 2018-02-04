import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import ExploreChartHeader from '../../../../javascripts/explore/components/ExploreChartHeader';
import ExploreActionButtons from '../../../../javascripts/explore/components/ExploreActionButtons';
import EditableTitle from '../../../../javascripts/components/EditableTitle';

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
    ).to.equal(true);
  });

  it('renders', () => {
    expect(wrapper.find(EditableTitle)).to.have.lengthOf(1);
    expect(wrapper.find(ExploreActionButtons)).to.have.lengthOf(1);
  });
});
