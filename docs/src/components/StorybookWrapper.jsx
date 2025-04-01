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
import {
  supersetTheme,
  ThemeProvider,
} from '../../../superset-frontend/packages/superset-ui-core/lib';

// A simple component to display a story example
export function StoryExample({ component: Component, props = {} }) {
  return (
    <ThemeProvider theme={supersetTheme}>
      <div
        className="storybook-example"
        style={{
          border: '1px solid #e8e8e8',
          borderRadius: '4px',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        {Component && <Component {...props} />}
      </div>
    </ThemeProvider>
  );
}

// A simple component to display a story with controls
export function StoryWithControls({
  component: Component,
  props = {},
  controls = [],
}) {
  const [stateProps, setStateProps] = React.useState(props);

  const updateProp = (key, value) => {
    setStateProps(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <ThemeProvider theme={supersetTheme}>
      <div className="storybook-with-controls">
        <div
          className="storybook-example"
          style={{
            border: '1px solid #e8e8e8',
            borderRadius: '4px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          {Component && <Component {...stateProps} />}
        </div>

        {controls.length > 0 && (
          <div
            className="storybook-controls"
            style={{
              border: '1px solid #e8e8e8',
              borderRadius: '4px',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <h4>Controls</h4>
            {controls.map(control => (
              <div key={control.name} style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  {control.label || control.name}:
                </label>
                {control.type === 'select' ? (
                  <select
                    value={stateProps[control.name]}
                    onChange={e => updateProp(control.name, e.target.value)}
                    style={{ width: '100%', padding: '5px' }}
                  >
                    {control.options.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : control.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={stateProps[control.name]}
                    onChange={e => updateProp(control.name, e.target.checked)}
                  />
                ) : (
                  <input
                    type="text"
                    value={stateProps[control.name]}
                    onChange={e => updateProp(control.name, e.target.value)}
                    style={{ width: '100%', padding: '5px' }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}
