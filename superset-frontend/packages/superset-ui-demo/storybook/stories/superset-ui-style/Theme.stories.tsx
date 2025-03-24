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

import { supersetTheme, SupersetTheme } from '@superset-ui/core';

type ColorCategory = keyof SupersetTheme['colors'];
export default {
  title: 'Core Packages/@superset-ui-style',
};

export const ThemeColors = () => {
  const { colors } = supersetTheme;

  // Define tones to be displayed in columns
  const tones = [
    'dark2',
    'dark1',
    'base',
    'light1',
    'light2',
    'light3',
    'light4',
    'light5',
  ];
  const colorTypes = [
    'primary',
    'secondary',
    'grayscale',
    'error',
    'warning',
    'alert',
    'success',
    'info',
  ];
  return (
    <div>
      <h1>Theme Colors</h1>
      <table
        style={{ borderCollapse: 'collapse', width: '100%', textAlign: 'left' }}
      >
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>
              Category
            </th>
            {tones.map(tone => (
              <th
                key={tone}
                style={{ border: '1px solid #ddd', padding: '8px' }}
              >
                {tone}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {colorTypes.map(category => (
            <tr key={category}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                <strong>{category}</strong>
              </td>
              {tones.map(tone => {
                const categoryColors = colors[category as ColorCategory];
                const color =
                  typeof categoryColors === 'object' &&
                  categoryColors !== null &&
                  tone in categoryColors
                    ? (categoryColors as Record<string, string>)[tone]
                    : undefined;
                return (
                  <td
                    key={tone}
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                      backgroundColor: color || '#fff',
                    }}
                  >
                    {color ? <code>{color}</code> : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <h3>
        text.label: <code>{colors.text.label}</code>
      </h3>
      <div style={{ color: `#${colors.text.label}` }}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </div>
      <h3>
        text.help: <code>{colors.text.help}</code>
      </h3>
      <div style={{ color: `#${colors.text.help}` }}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </div>
      <h3>The supersetTheme object</h3>
      <code>
        <pre>{JSON.stringify(supersetTheme, null, 2)}</pre>
      </code>
    </div>
  );
};
