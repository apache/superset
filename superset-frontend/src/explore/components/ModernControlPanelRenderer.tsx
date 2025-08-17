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
import { FC, ReactElement, cloneElement, isValidElement } from 'react';
import { JsonValue } from '@superset-ui/core';

/**
 * Props that modern control panels expect to receive
 */
export interface ModernControlPanelProps {
  values: Record<string, JsonValue>;
  onChange: (name: string, value: JsonValue) => void;
  datasource?: any;
  formData?: any;
  validationErrors?: Record<string, string[]>;
}

/**
 * Props passed from ControlPanelsContainer
 */
interface ModernControlPanelRendererProps {
  element: ReactElement;
  formData: any;
  controls: Record<string, any>;
  actions: {
    setControlValue: (name: string, value: any) => void;
  };
  datasource?: any;
  validationErrors?: Record<string, string[]>;
}

/**
 * This component acts as a bridge between the legacy ControlPanelsContainer
 * and modern React-based control panels.
 *
 * It detects if a control panel element expects modern props and provides them,
 * allowing modern control panels to work within the existing system.
 */
export const ModernControlPanelRenderer: FC<
  ModernControlPanelRendererProps
> = ({
  element,
  formData,
  controls,
  actions,
  datasource,
  validationErrors,
}) => {
  console.log('ModernControlPanelRenderer - element:', element);
  console.log('ModernControlPanelRenderer - typeof element:', typeof element);
  console.log(
    'ModernControlPanelRenderer - isModernPanel?:',
    (element as any)?.isModernPanel,
  );

  // Check if this is a modern control panel component constructor (not an instance)
  if (typeof element === 'function' && (element as any).isModernPanel) {
    console.log('ModernControlPanelRenderer - Rendering modern panel');
    const ModernPanel = element as FC<ModernControlPanelProps>;

    // Create the modern props for the component
    const modernProps = {
      value: formData,
      onChange: (name: string, value: JsonValue) => {
        actions.setControlValue(name, value);
      },
      datasource,
      form_data: formData,
      controls,
      actions,
      validationErrors,
    };

    return <ModernPanel {...modernProps} />;
  }

  // Check if this is already a React element instance
  if (isValidElement(element)) {
    const elementType = element.type as any;
    const isModernPanel =
      element.props &&
      ('value' in element.props ||
        'onChange' in element.props ||
        elementType?.name?.includes('PieControlPanel') ||
        elementType?.name?.includes('Modern') ||
        elementType?.isModernPanel);

    if (!isModernPanel) {
      // If it's not a modern panel, render as-is
      return element;
    }

    // Create the modern props adapter for the new naming convention
    const modernProps = {
      value: formData,
      onChange: (name: string, value: JsonValue) => {
        actions.setControlValue(name, value);
      },
      datasource,
      controls,
      formData,
      actions,
      validationErrors,
    };

    // Clone the element with the modern props
    return cloneElement(element, modernProps);
  }

  // If it's neither a function nor an element, just return it
  return element as ReactElement;
};

/**
 * Helper to check if an element is a modern control panel
 */
export const isModernControlPanel = (element: any): boolean => {
  if (!isValidElement(element)) {
    return false;
  }

  const elementType = element.type as any;
  const props = element.props as any;
  return (
    elementType?.name?.includes('PieControlPanel') ||
    elementType?.name?.includes('Modern') ||
    elementType?.displayName?.includes('Modern') ||
    props?.isModernPanel === true
  );
};

/**
 * Wraps a modern control panel component to mark it as modern
 */
export function withModernPanelMarker<P extends ModernControlPanelProps>(
  Component: FC<P>,
): FC<P> {
  const WrappedComponent: FC<P> = props => <Component {...(props as P)} />;

  WrappedComponent.displayName = `Modern${Component.displayName || Component.name}`;

  return WrappedComponent;
}
