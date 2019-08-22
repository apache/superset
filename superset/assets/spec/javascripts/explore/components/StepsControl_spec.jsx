/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { shallow } from 'enzyme';

import chartQueries, { sliceId as chartId } from '../../dashboard/fixtures/mockChartQueries';
import StepsControl from '../../../../src/explore/components/controls/StepsControl';
import Button from '../../../../src/components/Button';
import { OverlayTrigger, Popover, ListGroup, ListGroupItem, Label } from 'react-bootstrap';

const defaultProps = {
  name: 'steps',
  label: 'Steps',
  value: {},
  origSelectedValues: {},
  vizType: '',
  annotationError: {},
  annotationQuery: {},
  onChange: () => {},
};

describe('StepsControl', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const initialState = {
    charts: { 0: {} },
    explore: {
      can_overwrite: null,
      user_id: '1',
      datasource: {},
      slice: null,
      controls: {
        viz_type: {
          value: 'funnel',
        },
      },
    },
    selectedValues: {},
  };
  const store = mockStore(initialState);

  const defaultProps = {
    name: 'steps',
    label: 'Steps',
    value: {},
    origSelectedValues: {},
    vizType: '',
    annotationError: {},
    annotationQuery: {},
    onChange: () => {},
    charts: chartQueries,
  };
  const mockEvent = {
    target: {
      value: 'mock event target',
    },
    value: 'mock value',
  };

  const getWrapper = () =>
    shallow(<StepsControl {...defaultProps} />, {
      context: { store },
    }).dive();

  it('renders Add Step button and Absolute filter', () => {
    const wrapper = getWrapper();
    expect(wrapper.find(ListGroupItem)).toHaveLength(1);
  });

  it('add/remove Step', () => {
    const wrapper = getWrapper();
    const label = wrapper.find(ListGroupItem).first();
    label.simulate('click');
    setTimeout(() => {
      expect(wrapper.find('.list-group')).toHaveLength(1);
      expect(wrapper.find('.metrics-select')).toHaveLength(2);
      expect(wrapper.find(Button)).toHaveLength(1);
      expect(wrapper.find(Button)).first().simulate('click');
      setTimeout(() => {
        expect(wrapper.find('list-group')).toHaveLength(0);
      }, 10);
    }, 10);
  });

  it('onChange', () => {
    const wrapper = getWrapper();

    wrapper.instance().onChange(0, 'testControl', { test: true });
    expect(wrapper.state().selectedValues).toMatchObject({ 0: { testControl: { test: true } } });

  });
});
