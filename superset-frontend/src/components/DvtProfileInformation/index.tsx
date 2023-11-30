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
import {
  StyledProfileIndormation,
  StyledProfileImage,
  StyledHeading,
  StyledInformation,
  StyledInformationDiv,
  StyledLabel,
} from './dvt-profile-information.module';

export interface DvtProfileInformationProps {
  image: string;
  header: string;
  location: string;
  joinedDate: Date;
  title: string;
  test: string;
}

const DvtProfileInformation: React.FC<DvtProfileInformationProps> = ({
  image,
  header,
  location,
  joinedDate,
  title,
  test,
}) => {
  const getTimeAgo = (joinedDate: Date | string): string => {
    let dateToUse = joinedDate;

    if (!(dateToUse instanceof Date)) {
      dateToUse = new Date(dateToUse);
    }

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dateToUse.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 1) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      return `Joined ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    if (diffDays < 7) {
      return `Joined ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
    if (diffDays < 30) {
      const diffWeeks = Math.floor(diffDays / 7);
      return `Joined ${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
    }
    if (diffDays < 365) {
      const diffMonths = Math.floor(diffDays / 30);
      return `Joined ${diffMonths} ${
        diffMonths === 1 ? 'month' : 'months'
      } ago`;
    }

    const diffYears = Math.floor(diffDays / 365);
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    return `Joined ${diffYears} ${diffYears === 1 ? 'year' : 'years'} ${
      remainingMonths > 0 ? `and ${remainingMonths} months` : ''
    } ago`;
  };

  return (
    <StyledProfileIndormation>
      <StyledProfileImage>
        <img
          src={image}
          alt="Profile"
          height={155}
          width={155}
          style={{ borderRadius: '155px' }}
        />
      </StyledProfileImage>
      <StyledHeading>{header}</StyledHeading>
      <StyledInformation>
        <StyledInformationDiv>{location}</StyledInformationDiv>
        <StyledInformationDiv>{getTimeAgo(joinedDate)}</StyledInformationDiv>
      </StyledInformation>
      <StyledLabel>Title: {title}</StyledLabel>
      <StyledLabel>Test: {test}</StyledLabel>
    </StyledProfileIndormation>
  );
};

export default DvtProfileInformation;
