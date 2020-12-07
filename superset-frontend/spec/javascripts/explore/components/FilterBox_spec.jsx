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
import { shallow, mount } from 'enzyme';

import FilterBox from 'src/visualizations/FilterBox/FilterBox';
import SelectControl from 'src/explore/components/controls/SelectControl';

describe('FilterBox', () => {
  it('should only add defined non-predefined options to filtersChoices', () => {
    const wrapper = shallow(
      <FilterBox
        chartId={1001}
        datasource={{ id: 1 }}
        filtersChoices={{
          name: [
            { id: 'John', text: 'John', metric: 1234 },
            { id: 'Jane', text: 'Jane', metric: 345678 },
          ],
        }}
        filtersFields={[
          {
            asc: false,
            clearable: true,
            column: 'name',
            key: 'name',
            label: 'name',
            metric: 'sum__COUNT',
            multiple: true,
          },
        ]}
        origSelectedValues={{}}
      />,
    );
    const inst = wrapper.instance();
    // choose a predefined value
    inst.setState({ selectedValues: { name: ['John'] } });
    expect(inst.props.filtersChoices.name.length).toEqual(2);
    // reset selection
    inst.setState({ selectedValues: { name: null } });
    expect(inst.props.filtersChoices.name.length).toEqual(2);
    // Add a new name
    inst.setState({ selectedValues: { name: 'James' } });
    expect(inst.props.filtersChoices.name.length).toEqual(3);
  });

  it('should support granularity_sqla options', () => {
    const wrapper = mount(
      <FilterBox
        chartId={1001}
        datasource={{
          id: 1,
          columns: [],
          databases: {},
          granularity_sqla: [
            ['created_on', 'created_on'],
            ['changed_on', 'changed_on'],
          ],
        }}
        showSqlaTimeColumn
        instantFiltering
      />,
    );

    expect(wrapper.find(SelectControl).props().choices).toEqual(
      expect.arrayContaining([
        ['created_on', 'created_on'],
        ['changed_on', 'changed_on'],
      ]),
    );
  });
});
