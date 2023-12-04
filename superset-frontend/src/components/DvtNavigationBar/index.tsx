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
import DvtNavigationBarItem from '../DvtNavigationBarItem';
import { StyledNavigationBar } from './dvt-navigation-bar.module';

interface DataProps {
  icon: string;
  label: string;
  url?: string;
}

export interface DvtNavigationBarProps {
  data: DataProps[];
  active?: string;
  setActive?: (newUrl: string) => void;
}

const DvtNavigationBar: React.FC<DvtNavigationBarProps> = ({
  data,
  active,
  setActive,
}) => (
  <StyledNavigationBar>
    {data.map((item, index) => (
      <DvtNavigationBarItem
        key={index}
        icon={item.icon}
        label={item.label}
        onClick={() => {
          if (item.url) {
            setActive?.(item.url);
          }
        }}
        active={item.url ? item.url === active : false}
      />
    ))}
  </StyledNavigationBar>
);

export default DvtNavigationBar;
