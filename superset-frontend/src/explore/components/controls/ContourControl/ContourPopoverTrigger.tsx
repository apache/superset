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
import React, { useState } from 'react';
import ContourPopoverControl from './ContourPopoverControl';
import ControlPopover from '../ControlPopover/ControlPopover';
import { ContourPopoverTriggerProps } from './types';

const ContourPopoverTrigger = ({
  value: initialValue,
  saveContour,
  isControlled,
  visible: controlledVisibility,
  toggleVisibility,
  ...props
}: ContourPopoverTriggerProps) => {
  const [isVisible, setIsVisible] = useState(false);

  const visible = isControlled ? controlledVisibility : isVisible;
  const setVisibility =
    isControlled && toggleVisibility ? toggleVisibility : setIsVisible;

  const popoverContent = (
    <ContourPopoverControl
      value={initialValue}
      onSave={saveContour}
      onClose={() => setVisibility(false)}
    />
  );

  return (
    <ControlPopover
      trigger="click"
      content={popoverContent}
      defaultVisible={visible}
      visible={visible}
      onVisibleChange={setVisibility}
      destroyTooltipOnHide
    >
      {props.children}
    </ControlPopover>
  );
};

export default ContourPopoverTrigger;
