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

/**
 * Wrapper component that automatically selects the appropriate control panel container
 * based on whether the chart's control panel uses JSON Forms or legacy format
 */
export const ControlPanelsContainerWrapper = (props: any) => {
  const { exploreState, ...restProps } = props;
  const { vizType } = exploreState;

  // Check if the control panel uses JSON Forms format
  const isJsonFormsFormat = useMemo(() => {
    if (!vizType) return false;
    
    const controlPanelConfig = getChartControlPanelRegistry().get(vizType);
    if (!controlPanelConfig) return false;

    // JSON Forms format has 'schema' and 'uischema' properties
    // Legacy format has 'controlPanelSections' property
    return !!(controlPanelConfig.schema && controlPanelConfig.uischema);
  }, [vizType]);

  // Use the appropriate container based on the format
  const Container = isJsonFormsFormat
    ? ControlPanelsContainerJsonForms
    : ControlPanelsContainer;

  return <Container exploreState={exploreState} {...restProps} />;
};

export default ControlPanelsContainerWrapper;