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
import { ModalFuncProps } from 'antd/lib/modal';
import React from 'react';
import Modal, { ModalProps } from '.';
import Button from '../Button';

export default {
  title: 'Modal',
  component: Modal,
};

export const InteractiveModal = (props: ModalProps) => (
  <Modal {...props}>Hi</Modal>
);

InteractiveModal.args = {
  disablePrimaryButton: false,
  primaryButtonName: 'Danger',
  primaryButtonType: 'danger',
  show: true,
  title: "I'm a modal!",
  resizable: false,
  draggable: false,
};

InteractiveModal.argTypes = {
  onHandledPrimaryAction: { action: 'onHandledPrimaryAction' },
  onHide: { action: 'onHide' },
};

InteractiveModal.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};

export const ModalFunctions = (props: ModalFuncProps) => (
  <div>
    <Button onClick={() => Modal.error(props)}>Error</Button>
    <Button onClick={() => Modal.warning(props)}>Warning</Button>
    <Button onClick={() => Modal.confirm(props)}>Confirm</Button>
  </div>
);

ModalFunctions.args = {
  title: 'Modal title',
  content: 'Modal content',
};
