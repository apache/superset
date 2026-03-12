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
import { useState } from 'react';
import ControlPopover from '../ControlPopover/ControlPopover';
import { ColorBreakpointsPopoverTriggerProps } from './types';
import ColorBreakpointPopoverControl from './ColorBreakpointPopoverControl';

const ColorBreakpointsPopoverTrigger = ({
  value: initialValue,
  saveColorBreakpoint,
  isControlled,
  visible: controlledVisibility,
  toggleVisibility,
  colorBreakpoints,
  ...props
}: ColorBreakpointsPopoverTriggerProps) => {
  const [isVisible, setIsVisible] = useState(false);

  const visible = isControlled ? controlledVisibility : isVisible;
  const setVisibility =
    isControlled && toggleVisibility ? toggleVisibility : setIsVisible;

  const popoverContent = (
    <ColorBreakpointPopoverControl
      value={initialValue}
      colorBreakpoints={colorBreakpoints}
      onSave={saveColorBreakpoint}
      onClose={() => setVisibility(false)}
    />
  );

  return (
    <ControlPopover
      trigger="click"
      content={popoverContent}
      defaultOpen={visible}
      open={visible}
      onOpenChange={setVisibility}
      destroyOnHidden
    >
      {props.children}
    </ControlPopover>
  );
};

export default ColorBreakpointsPopoverTrigger;
