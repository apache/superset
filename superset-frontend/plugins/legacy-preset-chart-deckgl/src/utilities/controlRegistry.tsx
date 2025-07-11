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

import { ControlType } from '@superset-ui/chart-controls';
import { TooltipTemplateControl } from './TooltipTemplateControl';

/**
 * Registry for custom control components used in DeckGL charts
 */
export const deckGLControlRegistry = {
  TooltipTemplateControl,
};

/**
 * Expand control type to include local DeckGL controls
 */
export function expandDeckGLControlType(controlType: ControlType) {
  if (typeof controlType === 'string' && controlType in deckGLControlRegistry) {
    return deckGLControlRegistry[
      controlType as keyof typeof deckGLControlRegistry
    ];
  }
  return controlType;
}

/**
 * HOC to wrap control components with DeckGL-specific logic
 */
export function withDeckGLControls(Component: React.ComponentType<any>) {
  return function DeckGLControlWrapper(props: any) {
    const { type, ...otherProps } = props;
    const ExpandedComponent = expandDeckGLControlType(type) || Component;
    return <ExpandedComponent {...otherProps} />;
  };
}

export default deckGLControlRegistry;
