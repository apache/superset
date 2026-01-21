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
import BrowserOnly from '@docusaurus/BrowserOnly';

// Lazy-loaded component registry - populated on first use in browser
let componentRegistry = null;
let SupersetProviders = null;
let loadError = null;

function getComponentRegistry() {
  if (typeof window === 'undefined') {
    return {}; // SSR - return empty
  }

  if (componentRegistry !== null) {
    return componentRegistry; // Already loaded
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SupersetComponents = require('@superset/components');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const CoreUI = require('@apache-superset/core/ui');

    // Build component registry
    componentRegistry = { ...SupersetComponents, ...CoreUI };

    // Debug: log available components
    console.log('[StorybookWrapper] Loaded components:', Object.keys(componentRegistry).slice(0, 20));
    console.log('[StorybookWrapper] Has Button?', 'Button' in componentRegistry);

    return componentRegistry;
  } catch (error) {
    console.error('[StorybookWrapper] Failed to load components:', error);
    loadError = error;
    componentRegistry = {};
    return componentRegistry;
  }
}

function getProviders() {
  if (typeof window === 'undefined') {
    return ({ children }) => children; // SSR
  }

  if (SupersetProviders !== null) {
    return SupersetProviders;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { themeObject } = require('@apache-superset/core/ui');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { App } = require('antd');

    SupersetProviders = ({ children }) => (
      <themeObject.SupersetThemeProvider>
        <App>{children}</App>
      </themeObject.SupersetThemeProvider>
    );
    return SupersetProviders;
  } catch (error) {
    console.error('[StorybookWrapper] Failed to load providers:', error);
    return ({ children }) => children;
  }
}

// Resolve component from string name or React component
function resolveComponent(component) {
  if (!component) return null;
  // If already a component (function/class), return as-is
  if (typeof component === 'function') return component;
  // If string, look up in registry
  if (typeof component === 'string') {
    const registry = getComponentRegistry();
    return registry[component] || null;
  }
  return null;
}

// Loading placeholder for SSR
function LoadingPlaceholder() {
  return (
    <div
      style={{
        border: '1px solid #e8e8e8',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '20px',
        minHeight: '100px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#999',
      }}
    >
      Loading component...
    </div>
  );
}

// A simple component to display a story example
export function StoryExample({ component, props = {} }) {
  return (
    <BrowserOnly fallback={<LoadingPlaceholder />}>
      {() => {
        const Component = resolveComponent(component);
        const Providers = getProviders();
        const { children, restProps } = extractChildren(props);
        return (
          <Providers>
            <div
              className="storybook-example"
              style={{
                border: '1px solid #e8e8e8',
                borderRadius: '4px',
                padding: '20px',
                marginBottom: '20px',
              }}
            >
              {Component ? (
                <Component {...restProps}>{children}</Component>
              ) : (
                <div style={{ color: '#999' }}>
                  Component &quot;{String(component)}&quot; not found
                </div>
              )}
            </div>
          </Providers>
        );
      }}
    </BrowserOnly>
  );
}

// Props that should be rendered as children rather than passed as props
const CHILDREN_PROP_NAMES = ['label', 'children', 'text', 'content'];

// Extract children from props based on common conventions
function extractChildren(props) {
  for (const propName of CHILDREN_PROP_NAMES) {
    if (props[propName] !== undefined && props[propName] !== null && props[propName] !== '') {
      const { [propName]: childContent, ...restProps } = props;
      return { children: childContent, restProps };
    }
  }
  return { children: null, restProps: props };
}

// Generate sample children for layout components
// Supports:
// - Array of strings: ['Item 1', 'Item 2'] - renders as styled divs
// - Array of component descriptors: [{ component: 'Button', props: { children: 'Click' } }]
// - Number: 3 - generates that many sample items
// - String: 'content' - renders as literal content
function generateSampleChildren(sampleChildren, sampleChildrenStyle) {
  if (!sampleChildren) return null;

  // Default style if none provided (minimal, just enough to see items)
  const itemStyle = sampleChildrenStyle || {};

  // If it's an array, check if items are component descriptors or strings
  if (Array.isArray(sampleChildren)) {
    return sampleChildren.map((item, i) => {
      // Component descriptor: { component: 'Button', props: { ... } }
      if (item && typeof item === 'object' && item.component) {
        const ChildComponent = resolveComponent(item.component);
        if (ChildComponent) {
          return <ChildComponent key={i} {...item.props} />;
        }
        // Fallback if component not found
        return <div key={i}>{item.props?.children || `Unknown: ${item.component}`}</div>;
      }
      // Simple string
      return (
        <div key={i} style={itemStyle}>
          {item}
        </div>
      );
    });
  }

  // If it's a number, generate that many sample items
  if (typeof sampleChildren === 'number') {
    return new Array(sampleChildren).fill(null).map((_, i) => (
      <div key={i} style={itemStyle}>
        Item {i + 1}
      </div>
    ));
  }

  // If it's a string, treat as literal content
  if (typeof sampleChildren === 'string') {
    return sampleChildren;
  }

  return sampleChildren;
}

// Inner component for StoryWithControls (browser-only)
function StoryWithControlsInner({ component, props, controls, sampleChildren, sampleChildrenStyle }) {
  const Component = resolveComponent(component);
  const Providers = getProviders();
  const [stateProps, setStateProps] = React.useState(props);

  const updateProp = (key, value) => {
    setStateProps(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Extract children from props (label, children, text, content)
  const { children: propsChildren, restProps } = extractChildren(stateProps);
  // Use sample children if provided, otherwise use props children
  const children = generateSampleChildren(sampleChildren, sampleChildrenStyle) || propsChildren;

  return (
    <Providers>
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
          {Component ? (
            <Component {...restProps}>{children}</Component>
          ) : (
            <div style={{ color: '#999' }}>
              Component &quot;{String(component)}&quot; not found
            </div>
          )}
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
                    {control.options?.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : control.type === 'inline-radio' || control.type === 'radio' ? (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {control.options?.map(option => (
                      <label
                        key={option}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <input
                          type="radio"
                          name={control.name}
                          value={option}
                          checked={stateProps[control.name] === option}
                          onChange={e => updateProp(control.name, e.target.value)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : control.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={stateProps[control.name]}
                    onChange={e => updateProp(control.name, e.target.checked)}
                  />
                ) : control.type === 'number' ? (
                  <input
                    type="number"
                    value={stateProps[control.name]}
                    onChange={e => updateProp(control.name, Number(e.target.value))}
                    style={{ width: '100%', padding: '5px' }}
                  />
                ) : control.type === 'color' ? (
                  <input
                    type="color"
                    value={stateProps[control.name] || '#000000'}
                    onChange={e => updateProp(control.name, e.target.value)}
                    style={{
                      width: '50px',
                      height: '30px',
                      padding: '2px',
                      cursor: 'pointer',
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={stateProps[control.name] ?? ''}
                    onChange={e => updateProp(control.name, e.target.value)}
                    style={{ width: '100%', padding: '5px' }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Providers>
  );
}

// A simple component to display a story with controls
export function StoryWithControls({ component: Component, props = {}, controls = [], sampleChildren, sampleChildrenStyle }) {
  return (
    <BrowserOnly fallback={<LoadingPlaceholder />}>
      {() => (
        <StoryWithControlsInner
          component={Component}
          props={props}
          controls={controls}
          sampleChildren={sampleChildren}
          sampleChildrenStyle={sampleChildrenStyle}
        />
      )}
    </BrowserOnly>
  );
}

// Inner component for ComponentGallery (browser-only)
function ComponentGalleryInner({ component, sizes, styles, sizeProp, styleProp }) {
  const Component = resolveComponent(component);
  const Providers = getProviders();

  if (!Component) {
    return (
      <div style={{ color: '#999' }}>
        Component &quot;{String(component)}&quot; not found
      </div>
    );
  }

  return (
    <Providers>
      <div className="component-gallery">
        {sizes.map(size => (
          <div key={size} style={{ marginBottom: 40 }}>
            <h4 style={{ marginBottom: 16, color: '#666' }}>{size}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              {styles.map(style => (
                <Component
                  key={`${style}_${size}`}
                  {...{ [sizeProp]: size, [styleProp]: style }}
                >
                  {style}
                </Component>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Providers>
  );
}

// A component to display a gallery of all variants (sizes x styles)
export function ComponentGallery({ component, sizes = [], styles = [], sizeProp = 'size', styleProp = 'variant' }) {
  return (
    <BrowserOnly fallback={<LoadingPlaceholder />}>
      {() => (
        <ComponentGalleryInner
          component={component}
          sizes={sizes}
          styles={styles}
          sizeProp={sizeProp}
          styleProp={styleProp}
        />
      )}
    </BrowserOnly>
  );
}
