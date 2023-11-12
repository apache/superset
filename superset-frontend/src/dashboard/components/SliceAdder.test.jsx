/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import SliceAdder, {
  ChartList,
  DEFAULT_SORT_KEY,
} from 'src/dashboard/components/SliceAdder';
import { sliceEntitiesForDashboard as mockSliceEntities } from 'spec/fixtures/mockSliceEntities';
import { styledShallow } from 'spec/helpers/theming';

jest.mock('lodash/debounce', () => fn => {
  // eslint-disable-next-line no-param-reassign
  fn.throttle = jest.fn();
  return fn;
});

describe('SliceAdder', () => {
  const props = {
    ...mockSliceEntities,
    fetchSlices: jest.fn(),
    updateSlices: jest.fn(),
    selectedSliceIds: [127, 128],
    userId: 1,
  };
  const errorProps = {
    ...props,
    errorMessage: 'this is error',
  };

  describe('SliceAdder.sortByComparator', () => {
    it('should sort by timestamp descending', () => {
      const sortedTimestamps = Object.values(props.slices)
        .sort(SliceAdder.sortByComparator('changed_on'))
        .map(slice => slice.changed_on);
      expect(
        sortedTimestamps.every((currentTimestamp, index) => {
          if (index === 0) {
            return true;
          }
          return currentTimestamp < sortedTimestamps[index - 1];
        }),
      ).toBe(true);
    });

    it('should sort by slice_name', () => {
      const sortedNames = Object.values(props.slices)
        .sort(SliceAdder.sortByComparator('slice_name'))
        .map(slice => slice.slice_name);
      const expectedNames = Object.values(props.slices)
        .map(slice => slice.slice_name)
        .sort();
      expect(sortedNames).toEqual(expectedNames);
    });
  });

  it('render chart list', () => {
    const wrapper = styledShallow(<SliceAdder {...props} />);
    wrapper.setState({ filteredSlices: Object.values(props.slices) });
    expect(wrapper.find(ChartList)).toExist();
  });

  it('render error', () => {
    const wrapper = shallow(<SliceAdder {...errorProps} />);
    wrapper.setState({ filteredSlices: Object.values(props.slices) });
    expect(wrapper.text()).toContain(errorProps.errorMessage);
  });

  it('componentDidMount', () => {
    sinon.spy(SliceAdder.prototype, 'componentDidMount');
    sinon.spy(props, 'fetchSlices');

    shallow(<SliceAdder {...props} />, {
      lifecycleExperimental: true,
    });
    expect(SliceAdder.prototype.componentDidMount.calledOnce).toBe(true);
    expect(props.fetchSlices.calledOnce).toBe(true);

    SliceAdder.prototype.componentDidMount.restore();
    props.fetchSlices.restore();
  });

  describe('UNSAFE_componentWillReceiveProps', () => {
    let wrapper;
    beforeEach(() => {
      wrapper = shallow(<SliceAdder {...props} />);
      wrapper.setState({ filteredSlices: Object.values(props.slices) });
      sinon.spy(wrapper.instance(), 'setState');
    });
    afterEach(() => {
      wrapper.instance().setState.restore();
    });

    it('fetch slices should update state', () => {
      wrapper.instance().UNSAFE_componentWillReceiveProps({
        ...props,
        lastUpdated: new Date().getTime(),
      });
      expect(wrapper.instance().setState.calledOnce).toBe(true);

      const stateKeys = Object.keys(
        wrapper.instance().setState.lastCall.args[0],
      );
      expect(stateKeys).toContain('filteredSlices');
    });

    it('select slices should update state', () => {
      wrapper.instance().UNSAFE_componentWillReceiveProps({
        ...props,
        selectedSliceIds: [127],
      });
      expect(wrapper.instance().setState.calledOnce).toBe(true);

      const stateKeys = Object.keys(
        wrapper.instance().setState.lastCall.args[0],
      );
      expect(stateKeys).toContain('selectedSliceIdsSet');
    });
  });

  describe('should rerun filter and sort', () => {
    let wrapper;
    let spy;
    beforeEach(() => {
      spy = props.fetchSlices;
      wrapper = shallow(<SliceAdder {...props} fetchSlices={spy} />);
      wrapper.setState({ filteredSlices: Object.values(props.slices) });
    });
    afterEach(() => {
      spy.mockReset();
    });

    it('searchUpdated', () => {
      const newSearchTerm = 'new search term';
      wrapper.instance().handleChange(newSearchTerm);
      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(
        props.userId,
        newSearchTerm,
        DEFAULT_SORT_KEY,
      );
    });

    it('handleSelect', () => {
      const newSortBy = 'viz_type';
      wrapper.instance().handleSelect(newSortBy);
      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(props.userId, '', newSortBy);
    });
  });
});
