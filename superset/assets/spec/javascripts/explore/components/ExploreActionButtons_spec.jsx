import React from 'react';
import { shallow } from 'enzyme';
import ExploreActionButtons from
  '../../../../src/explore/components/ExploreActionButtons';

describe('ExploreActionButtons', () => {
  const defaultProps = {
    actions: {},
    canDownload: 'True',
    latestQueryFormData: {},
    queryEndpoint: 'localhost',
  };

  it('renders', () => {
    expect(
      React.isValidElement(<ExploreActionButtons {...defaultProps} />),
    ).toBe(true);
  });

  it('should render 5 children/buttons', () => {
    const wrapper = shallow(<ExploreActionButtons {...defaultProps} />);
    expect(wrapper.children()).toHaveLength(5);
  });
});
