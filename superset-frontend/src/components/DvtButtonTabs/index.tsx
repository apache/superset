/* eslint-disable translation-vars/no-template-vars */
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
import DvtButton from '../DvtButton';
import { StyledDvtButtonTabs } from './dvt-button-tabs.module';

interface TabData {
  label: string;
  icon?: string;
}

export interface DvtButtonTabsProps {
  data: TabData[];
  active: string;
  setActive: (tabs: string) => void;
}

const DvtButtonTabs: React.FC<DvtButtonTabsProps> = ({
  data,
  active,
  setActive,
}) => (
  <StyledDvtButtonTabs>
    {data.map((tabs: TabData, index: number) => (
      <DvtButton
        key={index}
        colour={active === tabs.label ? 'primary' : 'grayscale'}
        typeColour={active === tabs.label ? 'powder' : 'outline'}
        label={tabs.label}
        icon={tabs.icon}
        onClick={() => setActive(tabs.label)}
      />
    ))}
  </StyledDvtButtonTabs>
);

export default DvtButtonTabs;
