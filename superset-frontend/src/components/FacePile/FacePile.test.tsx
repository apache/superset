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
import { Provider } from 'react-redux';
import { styledMount as mount } from 'spec/helpers/theming';
import { Avatar } from 'src/components';
import { store } from 'src/views/store';
import FacePile from '.';
import { getRandomColor } from './utils';

const users = [...new Array(10)].map((_, i) => ({
  first_name: 'user',
  last_name: `${i}`,
  id: i,
}));

describe('FacePile', () => {
  const wrapper = mount(
    <Provider store={store}>
      <FacePile users={users} />
    </Provider>,
  );

  it('is a valid element', () => {
    expect(wrapper.find(FacePile)).toExist();
  });

  it('renders an Avatar', () => {
    expect(wrapper.find(Avatar)).toExist();
  });

  it('hides overflow', () => {
    expect(wrapper.find(Avatar).length).toBe(5);
  });
});

describe('utils', () => {
  describe('getRandomColor', () => {
    const colors = ['color1', 'color2', 'color3'];

    it('produces the same color for the same input values', () => {
      const name = 'foo';
      expect(getRandomColor(name, colors)).toEqual(
        getRandomColor(name, colors),
      );
    });

    it('produces a different color for different input values', () => {
      expect(getRandomColor('foo', colors)).not.toEqual(
        getRandomColor('bar', colors),
      );
    });

    it('handles non-ascii input values', () => {
      expect(getRandomColor('泰', colors)).toMatchInlineSnapshot(`"color1"`);
      expect(getRandomColor('مُحَمَّد‎', colors)).toMatchInlineSnapshot(
        `"color2"`,
      );
    });
  });
});
