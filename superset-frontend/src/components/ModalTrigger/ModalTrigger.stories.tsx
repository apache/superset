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
import ModalTrigger from '.';

interface IModalTriggerProps {
  triggerNode: React.ReactNode;
  dialogClassName?: string;
  modalTitle?: React.ReactNode;
  modalBody?: React.ReactNode;
  modalFooter?: React.ReactNode;
  beforeOpen?: () => void;
  onExit?: () => void;
  isButton?: boolean;
  className?: string;
  tooltip?: string;
  width?: string;
  maxWidth?: string;
  responsive?: boolean;
  draggable?: boolean;
  resizable?: boolean;
}

export default {
  title: 'ModalTrigger',
  component: ModalTrigger,
};

export const InteractiveModalTrigger = (args: IModalTriggerProps) => (
  <ModalTrigger triggerNode={<span>Click me</span>} {...args} />
);

InteractiveModalTrigger.args = {
  isButton: true,
  modalTitle: 'I am a modal title',
  modalBody: 'I am a modal body',
  modalFooter: 'I am a modal footer',
  tooltip: 'I am a tooltip',
  width: '600px',
  maxWidth: '1000px',
  responsive: true,
  draggable: false,
  resizable: false,
};
