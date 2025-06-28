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
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { supersetTheme, themeObject } from '@superset-ui/core';

const colorTypes = [
  'primary',
  'error',
  'warning',
  'success',
  'info',
  'grayscale',
];

const AntDFunctionalColors = () => {
  // Define color types and variants dynamically
  const variants = [
    'active',
    'textActive',
    'text',
    'textHover',
    'hover',
    'borderHover',
    'border',
    'bgHover',
    'bg',
  ];

  return (
    <table
      style={{ borderCollapse: 'collapse', width: '100%', textAlign: 'left' }}
    >
      <thead>
        <tr>
          <th style={{ border: '1px solid #ddd', padding: '8px' }}>Type</th>
          {variants.map(variant => (
            <th
              key={variant}
              style={{ border: '1px solid #ddd', padding: '8px' }}
            >
              {variant}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {colorTypes.map(type => (
          <tr key={type}>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
              <strong>{type}</strong>
            </td>
            {variants.map(variant => {
              const color = themeObject.getColorVariants(type)[variant];
              return (
                <td
                  key={variant}
                  style={{
                    border: '1px solid #ddd',
                    padding: '8px',
                    backgroundColor: color || 'transparent',
                    color: `color${type}${variant}`,
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
  );
};

export const ThemeColors = () => {
  const { colors } = supersetTheme;

  // Define tones to be displayed in columns
  const tones = [
    'dark5',
    'dark4',
    'dark3',
    'dark1',
    'base',
    'light1',
    'light2',
    'light3',
    'light4',
    'light5',
  ];
  return (
    <div>
      <h1>Theme Colors</h1>
      <h2>Legacy Theme Colors</h2>
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
                const color = colors[category][tone];
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
      <h2>Ant Design Theme Colors</h2>
      <h3>Functional Colors</h3>
      <AntDFunctionalColors />
      <h2>The supersetTheme object</h2>
      <pre>
        <code>{JSON.stringify(supersetTheme, null, 2)}</code>
      </pre>
    </div>
  );
};
/*
 * */
export default {
  title: 'Core Packages/@superset-ui-theme',
};

export const Default = () => <ThemeColors />;
