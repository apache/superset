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

import { supersetTheme } from '@apache-superset/core/ui';

const colorTypes = ['primary', 'error', 'warning', 'success', 'info'];

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
              // Map to actual theme token names
              const tokenName = `color${type.charAt(0).toUpperCase() + type.slice(1)}${variant.charAt(0).toUpperCase() + variant.slice(1)}`;
              const color = (supersetTheme as any)[tokenName];
              return (
                <td
                  key={variant}
                  style={{
                    border: '1px solid #ddd',
                    padding: '8px',
                    backgroundColor: color || 'transparent',
                    color: color === 'transparent' ? 'black' : undefined,
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

export const ThemeColors = () => (
  <div>
    <h1>Theme Colors</h1>
    <h2>Ant Design Theme Colors</h2>
    <h3>Functional Colors</h3>
    <AntDFunctionalColors />
    <h2>Current SupersetTheme Object</h2>
    <p>The current theme uses Ant Design's flat token structure:</p>
    <pre>
      <code>{JSON.stringify(supersetTheme, null, 2)}</code>
    </pre>
  </div>
);
/*
 * */
export default {
  title: 'Core Packages/@superset-ui-theme',
};

export const Default = () => <ThemeColors />;
