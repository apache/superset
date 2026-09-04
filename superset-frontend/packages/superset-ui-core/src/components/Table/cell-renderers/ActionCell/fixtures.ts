/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * License); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * AS IS BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { action } from '@storybook/addon-actions';
import { ActionMenuItem } from './index';

export const exampleMenuOptions: ActionMenuItem[] = [
  {
    label: 'Action 1',
    tooltip: "This is a tip, don't spend it all in one place",
    onClick: action('menu item onClick'),
    payload: {
      taco: 'spicy chicken',
    },
  },
  {
    label: 'Action 2',
    tooltip: 'This is another tip',
    onClick: action('menu item onClick'),
    payload: {
      taco: 'saucy tofu',
    },
  },
];

export const exampleRow = {
  key: 1,
  buttonCell: 'Click Me',
  textCell: 'Some text',
  euroCell: 45.5,
  dollarCell: 45.5,
};
