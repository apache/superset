import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { Modal } from 'react-bootstrap';
import { getChartMetadataRegistry, ChartMetadata } from '@superset-ui/chart';
import VizTypeControl from '../../../../src/explore/components/controls/VizTypeControl';

const defaultProps = {
  name: 'viz_type',
  label: 'Visualization Type',
  value: 'vis1',
  onChange: sinon.spy(),
};

describe('VizTypeControl', () => {
  let wrapper;

  const registry = getChartMetadataRegistry();
  registry
    .registerValue('vis1', new ChartMetadata({
      name: 'vis1',
      thumbnail: '',
    }))
    .registerValue('vis2', new ChartMetadata({
      name: 'vis2',
      thumbnail: '',
    }));

  beforeEach(() => {
    wrapper = shallow(<VizTypeControl {...defaultProps} />);
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toHaveLength(1);
  });

  it('calls onChange when toggled', () => {
    const select = wrapper.find('.viztype-selector-container').first();
    select.simulate('click');
    expect(defaultProps.onChange.called).toBe(true);
  });
  it('filters images based on text input', () => {
    expect(wrapper.find('img')).toHaveLength(2);
    wrapper.setState({ filter: 'vis2' });
    expect(wrapper.find('img')).toHaveLength(1);
  });
});
