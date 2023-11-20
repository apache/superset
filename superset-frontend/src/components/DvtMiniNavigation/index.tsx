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
import { SupersetTheme } from '@superset-ui/core';
import { RightOutlined } from '@ant-design/icons';
import {
  StyledDvtMiniNavigation,
  DvtMiniNavigationHeader,
  DvtMiniNavigationData,
  DvtMiniNavigationHeaderTitle,
  DvtMiniNavigationDataItem,
  DvtMiniNavigationAnimatedIcon,
} from './dvt-mini-navigation.module';

export interface DvtMiniNavigationProps {
  title: string;
  data: DataProps[];
}
export interface DataProps {
  url: string;
  text: string;
}

const DvtMiniNavigation: React.FC<DvtMiniNavigationProps> = ({
  title,
  data,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };
  return (
    <>
      <StyledDvtMiniNavigation>
        <DvtMiniNavigationHeader onClick={handleToggle}>
          <DvtMiniNavigationHeaderTitle>{title}</DvtMiniNavigationHeaderTitle>
          {data.length > 0 && (
            <DvtMiniNavigationAnimatedIcon $fadeIn={isOpen}>
              <RightOutlined
                css={(theme: SupersetTheme) => ({
                  color: theme.colors.dvt.text.label,
                })}
              />
            </DvtMiniNavigationAnimatedIcon>
          )}
        </DvtMiniNavigationHeader>
        {data.length > 0 &&
          isOpen &&
          data.map((item, index) => (
            <DvtMiniNavigationData key={index}>
              <DvtMiniNavigationDataItem to={item.url}>
                {item.text}
              </DvtMiniNavigationDataItem>
            </DvtMiniNavigationData>
          ))}
      </StyledDvtMiniNavigation>
    </>
  );
};

export default DvtMiniNavigation;
