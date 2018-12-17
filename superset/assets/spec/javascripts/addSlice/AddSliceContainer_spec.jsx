import React from 'react';
import { shallow } from 'enzyme';
import { Button } from 'react-bootstrap';
import Select from 'react-virtualized-select';
import AddSliceContainer from '../../../src/addSlice/AddSliceContainer';

const defaultProps = {
  datasources: [
    { label: 'my first table', value: '1__table' },
    { label: 'another great table', value: '2__table' },
  ],
};

describe('AddSliceContainer', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<AddSliceContainer {...defaultProps} />);
  });

  it('uses table as default visType', () => {
    expect(wrapper.state().visType).toBe('table');
  });

  it('renders 2 selects', () => {
    expect(wrapper.find(Select)).toHaveLength(2);
  });

  it('renders a button', () => {
    expect(wrapper.find(Button)).toHaveLength(1);
  });

  it('renders a disabled button if no datasource is selected', () => {
    expect(wrapper.find(Button).dive().find('.btn[disabled=true]')).toHaveLength(1);
  });

  it('renders an enabled button if datasource is selected', () => {
    const datasourceValue = defaultProps.datasources[0].value;
    wrapper.setState({
      datasourceValue,
      datasourceId: datasourceValue.split('__')[0],
      datasourceType: datasourceValue.split('__')[1],
    });
    expect(wrapper.find(Button).dive().find('.btn[disabled=false]')).toHaveLength(1);
  });

  it('formats explore url', () => {
    const datasourceValue = defaultProps.datasources[0].value;
    wrapper.setState({
      datasourceValue,
      datasourceId: datasourceValue.split('__')[0],
      datasourceType: datasourceValue.split('__')[1],
    });
    const formattedUrl = '/superset/explore/?form_data=%7B%22viz_type%22%3A%22table%22%2C%22datasource%22%3A%221__table%22%7D';
    expect(wrapper.instance().exploreUrl()).toBe(formattedUrl);
  });
});
