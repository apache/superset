/*
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

import { supersetTheme } from '@superset-ui/core';

export default {
  title: 'Core Packages/@superset-ui-style',
};

export const ThemeColors = () => {
  const { colors } = supersetTheme;
  return Object.keys(colors).map(collection => (
    <div>
      <h2>{collection}</h2>
      <table style={{ width: '300px' }}>
        {Object.keys(colors[collection]).map(k => {
          const hex = colors[collection][k];
          return (
            <tr>
              <td>{k}</td>
              <td>
                <code>{hex}</code>
              </td>
              <td style={{ width: '150px', backgroundColor: hex }} />
            </tr>
          );
        })}
      </table>
    </div>
  ));
};
