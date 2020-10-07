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
import { action } from '@storybook/addon-actions';
import { withKnobs, boolean } from '@storybook/addon-knobs';
import Modal from './Modal';
import Tabs from './Tabs';

export default {
  title: 'Common Components',
  decorators: [withKnobs],
};

export const StyledModal = () => (
  <Modal
    disablePrimaryButton={false}
    onHandledPrimaryAction={action('Primary Action')}
    primaryButtonName="Danger"
    primaryButtonType="danger"
    show
    onHide={action('hidden')}
    title="I'm a modal!"
  >
    <div>hi!</div>
  </Modal>
);

export const StyledTabs = () => (
  <Tabs defaultActiveKey="1" centered={boolean('Center tabs', false)}>
    <Tabs.TabPane
      tab="Tab 1"
      key="1"
      disabled={boolean('Tab 1 Disabled', false)}
    >
      Tab 1 Content!
    </Tabs.TabPane>
    <Tabs.TabPane
      tab="Tab 2"
      key="2"
      disabled={boolean('Tab 2 Disabled', false)}
    >
      Tab 2 Content!
    </Tabs.TabPane>
  </Tabs>
);
