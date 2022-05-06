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

import { List } from 'react-virtualized';

import SliceAdder from 'src/dashboard/components/SliceAdder';
import { sliceEntitiesForDashboard as mockSliceEntities } from 'spec/fixtures/mockSliceEntities';

describe('SliceAdder', () => {
  const mockEvent = {
    key: 'Enter',
    target: {
      value: 'mock event target',
    },
    preventDefault: () => {},
  };
  const props = {
    ...mockSliceEntities,
    fetchAllSlices: () => {},
    selectedSliceIds: [127, 128],
    userId: '1',
    height: 100,
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

  it('render List', () => {
    const wrapper = shallow(<SliceAdder {...props} />);
    wrapper.setState({ filteredSlices: Object.values(props.slices) });
    expect(wrapper.find(List)).toExist();
  });

  it('render error', () => {
    const wrapper = shallow(<SliceAdder {...errorProps} />);
    wrapper.setState({ filteredSlices: Object.values(props.slices) });
    expect(wrapper.text()).toContain(errorProps.errorMessage);
  });

  it('componentDidMount', () => {
    sinon.spy(SliceAdder.prototype, 'componentDidMount');
    sinon.spy(props, 'fetchAllSlices');

    shallow(<SliceAdder {...props} />, {
      lifecycleExperimental: true,
    });
    expect(SliceAdder.prototype.componentDidMount.calledOnce).toBe(true);
    expect(props.fetchAllSlices.calledOnce).toBe(true);

    SliceAdder.prototype.componentDidMount.restore();
    props.fetchAllSlices.restore();
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
      wrapper = shallow(<SliceAdder {...props} />);
      wrapper.setState({ filteredSlices: Object.values(props.slices) });
      spy = sinon.spy(wrapper.instance(), 'getFilteredSortedSlices');
    });
    afterEach(() => {
      spy.restore();
    });

    it('searchUpdated', () => {
      const newSearchTerm = 'new search term';
      wrapper.instance().searchUpdated(newSearchTerm);
      expect(spy.calledOnce).toBe(true);
      expect(spy.lastCall.args[0]).toBe(newSearchTerm);
    });

    it('handleSelect', () => {
      const newSortBy = 'viz_type';
      wrapper.instance().handleSelect(newSortBy);
      expect(spy.calledOnce).toBe(true);
      expect(spy.lastCall.args[1]).toBe(newSortBy);
    });

    it('handleKeyPress', () => {
      wrapper.instance().handleKeyPress(mockEvent);
      expect(spy.calledOnce).toBe(true);
      expect(spy.lastCall.args[0]).toBe(mockEvent.target.value);
    });
  });
});
