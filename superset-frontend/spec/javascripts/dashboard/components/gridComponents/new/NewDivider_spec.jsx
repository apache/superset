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

import DraggableNewComponent from 'src/dashboard/components/gridComponents/new/DraggableNewComponent';
import NewDivider from 'src/dashboard/components/gridComponents/new/NewDivider';

import { NEW_DIVIDER_ID } from 'src/dashboard/util/constants';
import { DIVIDER_TYPE } from 'src/dashboard/util/componentTypes';

describe('NewDivider', () => {
  function setup() {
    return shallow(<NewDivider />);
  }

  it('should render a DraggableNewComponent', () => {
    const wrapper = setup();
    expect(wrapper.find(DraggableNewComponent)).toHaveLength(1);
  });

  it('should set appropriate type and id', () => {
    const wrapper = setup();
    expect(wrapper.find(DraggableNewComponent).props()).toMatchObject({
      type: DIVIDER_TYPE,
      id: NEW_DIVIDER_ID,
    });
  });
});
