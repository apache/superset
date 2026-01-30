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

function getComponentRegistry() {
  if (typeof window === 'undefined') {
    return {}; // SSR - return empty
  }

  if (componentRegistry !== null) {
    return componentRegistry; // Already loaded
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const antd = require('antd');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SupersetComponents = require('@superset/components');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const CoreUI = require('@apache-superset/core/ui');

    // Build component registry with antd as base fallback layer.
    // Some Superset components (e.g., Typography) use styled-components that may
    // fail to initialize in the docs build. Antd originals serve as fallbacks.
    componentRegistry = { ...antd, ...SupersetComponents, ...CoreUI };

    return componentRegistry;
  } catch (error) {
    console.error('[StorybookWrapper] Failed to load components:', error);
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
    const { App, ConfigProvider } = require('antd');

    // Configure Ant Design to render portals (tooltips, dropdowns, etc.)
    // inside the closest .storybook-example container instead of document.body
    // This fixes positioning issues in the docs pages
    const getPopupContainer = (triggerNode) => {
      // Find the closest .storybook-example container
      const container = triggerNode?.closest?.('.storybook-example');
      return container || document.body;
    };

    SupersetProviders = ({ children }) => (
      <themeObject.SupersetThemeProvider>
        <ConfigProvider
          getPopupContainer={getPopupContainer}
          getTargetContainer={() => document.body}
        >
          <App>{children}</App>
        </ConfigProvider>
      </themeObject.SupersetThemeProvider>
    );
    return SupersetProviders;
  } catch (error) {
    console.error('[StorybookWrapper] Failed to load providers:', error);
    return ({ children }) => children;
  }
}

// Check if a value is a valid React component (function, forwardRef, memo, etc.)
function isReactComponent(value) {
  if (!value) return false;
  // Function/class components
  if (typeof value === 'function') return true;
  // forwardRef, memo, lazy — React wraps these as objects with $$typeof
  if (typeof value === 'object' && value.$$typeof) return true;
  return false;
}

// Resolve component from string name or React component
// Supports dot notation for nested components (e.g., 'Icons.InfoCircleOutlined')
function resolveComponent(component) {
  if (!component) return null;
  // If already a component (function/class/forwardRef), return as-is
  if (isReactComponent(component)) return component;
  // If string, look up in registry
  if (typeof component === 'string') {
    const registry = getComponentRegistry();
    // Handle dot notation (e.g., 'Icons.InfoCircleOutlined')
    if (component.includes('.')) {
      const parts = component.split('.');
      let current = registry[parts[0]];
      for (let i = 1; i < parts.length && current; i++) {
        current = current[parts[i]];
      }
      return isReactComponent(current) ? current : null;
    }
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
                position: 'relative', // Required for portal positioning
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
// renderComponent allows overriding which component to actually render (useful when the named
// component is a namespace object like Icons, not a React component)
// triggerProp: for components like Modal that need a trigger, specify the boolean prop that controls visibility
function StoryWithControlsInner({ component, renderComponent, props, controls, sampleChildren, sampleChildrenStyle, triggerProp, onHideProp }) {
  // Use renderComponent if provided, otherwise use the main component name
  const componentToRender = renderComponent || component;
  const Component = resolveComponent(componentToRender);
  const Providers = getProviders();
  const [stateProps, setStateProps] = React.useState(props);

  const updateProp = (key, value) => {
    setStateProps(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Extract children from props (label, children, text, content)
  // When sampleChildren is explicitly provided, skip extraction so all props
  // (like 'content') stay as component props rather than becoming children
  const { children: propsChildren, restProps } = sampleChildren
    ? { children: null, restProps: stateProps }
    : extractChildren(stateProps);
  // Filter out undefined values so they don't override component defaults
  const filteredProps = Object.fromEntries(
    Object.entries(restProps).filter(([, v]) => v !== undefined)
  );

  // Resolve any prop values that are component descriptors
  // e.g., { component: 'Button', props: { children: 'Click' } }
  // Also resolves descriptors nested inside array items:
  // e.g., items: [{ id: 'x', element: { component: 'div', props: { children: 'text' } } }]
  Object.keys(filteredProps).forEach(key => {
    const value = filteredProps[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && value.component) {
      const PropComponent = resolveComponent(value.component);
      if (PropComponent) {
        filteredProps[key] = <PropComponent {...value.props} />;
      }
    }
    if (Array.isArray(value)) {
      filteredProps[key] = value.map((item, idx) => {
        if (item && typeof item === 'object') {
          const resolved = { ...item };
          Object.keys(resolved).forEach(field => {
            const fieldValue = resolved[field];
            if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue) && fieldValue.component) {
              const FieldComponent = resolveComponent(fieldValue.component);
              if (FieldComponent) {
                resolved[field] = React.createElement(FieldComponent, { key: `${key}-${idx}`, ...fieldValue.props });
              }
            }
          });
          return resolved;
        }
        return item;
      });
    }
  });

  // For List-like components with dataSource but no renderItem, provide a default
  if (filteredProps.dataSource && !filteredProps.renderItem) {
    const ListItem = resolveComponent('List')?.Item;
    filteredProps.renderItem = (item) =>
      ListItem
        ? React.createElement(ListItem, null, String(item))
        : React.createElement('div', null, String(item));
  }

  // Use sample children if provided, otherwise use props children
  const children = generateSampleChildren(sampleChildren, sampleChildrenStyle) || propsChildren;

  // For components with a trigger (like Modal with show/onHide), add handlers.
  // onHideProp supports comma-separated names for components with multiple close
  // callbacks (e.g., "onHide,handleSave,onConfirmNavigation").
  const triggerProps = {};
  if (triggerProp && onHideProp) {
    const closeHandler = () => updateProp(triggerProp, false);
    onHideProp.split(',').forEach(prop => {
      triggerProps[prop.trim()] = closeHandler;
    });
  }

  // Get the Button component for trigger buttons
  const ButtonComponent = resolveComponent('Button');

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
            position: 'relative', // Required for portal positioning
          }}
        >
          {Component ? (
            <>
              {/* Show a trigger button for components like Modal */}
              {triggerProp && ButtonComponent && (
                <ButtonComponent onClick={() => updateProp(triggerProp, true)}>
                  Open {component}
                </ButtonComponent>
              )}
              <Component {...filteredProps} {...triggerProps}>{children}</Component>
            </>
          ) : (
            <div style={{ color: '#999' }}>
              Component &quot;{String(componentToRender)}&quot; not found
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
                    value={stateProps[control.name] ?? ''}
                    onChange={e => updateProp(control.name, e.target.value || undefined)}
                    style={{ width: '100%', padding: '5px' }}
                  >
                    <option value="">— None —</option>
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
// renderComponent: optional override for which component to render (e.g., 'Icons.InfoCircleOutlined' when component='Icons')
// triggerProp/onHideProp: for components like Modal that need a button to open (e.g., triggerProp="show", onHideProp="onHide")
export function StoryWithControls({ component: Component, renderComponent, props = {}, controls = [], sampleChildren, sampleChildrenStyle, triggerProp, onHideProp }) {
  return (
    <BrowserOnly fallback={<LoadingPlaceholder />}>
      {() => (
        <StoryWithControlsInner
          component={Component}
          renderComponent={renderComponent}
          props={props}
          controls={controls}
          sampleChildren={sampleChildren}
          sampleChildrenStyle={sampleChildrenStyle}
          triggerProp={triggerProp}
          onHideProp={onHideProp}
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
