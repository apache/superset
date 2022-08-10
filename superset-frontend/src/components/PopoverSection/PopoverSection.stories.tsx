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
import PopoverSection from '.';

export default {
  title: 'PopoverSection',
};

export const InteractivePopoverSection = (args: any) => (
  <PopoverSection {...args}>
    <div
      css={{
        display: 'flex',
        justifyContent: 'center',
        border: '1px solid',
        alignItems: 'center',
        width: 100,
        height: 100,
      }}
    >
      Content
    </div>
  </PopoverSection>
);

InteractivePopoverSection.args = {
  title: 'Title',
  isSelected: true,
  info: 'Some description about the content',
};

InteractivePopoverSection.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
