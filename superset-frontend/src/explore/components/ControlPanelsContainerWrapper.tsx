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
import { useMemo } from 'react';
import { getChartControlPanelRegistry } from '@superset-ui/core';
import ControlPanelsContainer from './ControlPanelsContainer';
import ControlPanelsContainerJsonForms from './ControlPanelsContainerJsonForms';
import ControlPanelsContainerNew from './ControlPanelsContainerNew';

/**
 * Wrapper component that automatically selects the appropriate control panel container
 * based on whether the chart's control panel uses JSON Forms, React components, or legacy format
 */
export const ControlPanelsContainerWrapper = (props: any) => {
  const { exploreState, ...restProps } = props;
  const { vizType } = exploreState;

  // Check what format the control panel uses
  const containerType = useMemo(() => {
    if (!vizType) return 'legacy';

    const controlPanelConfig = getChartControlPanelRegistry().get(vizType);
    console.log('Control panel config for', vizType, ':', controlPanelConfig);
    if (!controlPanelConfig) return 'legacy';

    // React component format - has a ControlPanel property that's a function/component
    if (
      controlPanelConfig.ControlPanel &&
      typeof controlPanelConfig.ControlPanel === 'function'
    ) {
      console.log('Using React control panel for', vizType);
      return 'react';
    }

    // React component format - the config itself is a function/component
    if (typeof controlPanelConfig === 'function') {
      console.log('Using React control panel for', vizType);
      return 'react';
    }

    // JSON Forms format has 'schema' and 'uischema' properties
    if (controlPanelConfig.schema && controlPanelConfig.uischema) {
      console.log('Using JSON Forms control panel for', vizType);
      return 'jsonforms';
    }

    // Legacy format has 'controlPanelSections' property
    console.log('Using legacy control panel for', vizType);
    return 'legacy';
  }, [vizType]);

  // Use the appropriate container based on the format
  let Container;
  switch (containerType) {
    case 'react':
      Container = ControlPanelsContainerNew;
      break;
    case 'jsonforms':
      Container = ControlPanelsContainerJsonForms;
      break;
    default:
      Container = ControlPanelsContainer;
  }

  return <Container exploreState={exploreState} {...restProps} />;
};

export default ControlPanelsContainerWrapper;
