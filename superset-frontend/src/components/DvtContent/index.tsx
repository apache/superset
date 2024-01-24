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
import moment from 'moment';
import {
  StyledContentListLi,
  StyledDvtContent,
  StyledDvtContentHeader,
  StyledDvtContentList,
  StyledDvtContentListUl,
  StyledDvtContentScroll,
  StyledDvtContentSubtitleP,
  StyledDvtContentTitle,
} from './dvt-content.module';

export interface HeaderProps {
  title: string;
  field: string;
  width?: number;
  withDateAgo?: boolean;
}
export interface DataProps {
  [objectName: string]: any;
}

export interface DvtContentProps {
  title: string;
  header: HeaderProps[];
  data: DataProps[];
}

const DvtContent: React.FC<DvtContentProps> = ({
  title = '',
  header,
  data,
}) => {
  const getFormattedDifference = (modified: moment.Moment) => {
    const now = moment();
    const diff = now.diff(modified);
    const duration = moment.duration(diff);

    const years = duration.years();
    const months = duration.months();
    const days = duration.days();
    const hours = duration.hours();
    const minutes = duration.minutes();

    let dateMessage = 'Just Now';

    if (years > 0) {
      dateMessage = `${years} Years Ago`;
    } else if (months > 0) {
      dateMessage = `${months} Months Ago`;
    } else if (days > 0) {
      dateMessage = `${days} Days Ago`;
    } else if (hours > 0) {
      dateMessage = `${hours} Hours Ago`;
    } else if (minutes > 0) {
      dateMessage = `${minutes} Minutes Ago`;
    }
    return dateMessage;
  };

  return (
    <StyledDvtContent>
      <StyledDvtContentTitle>{title}</StyledDvtContentTitle>
      <StyledDvtContentHeader>
        {header.map((item, index) => (
          <StyledDvtContentSubtitleP
            key={index}
            style={{
              width: item.width ? item.width : 'auto',
              flex: item.width ? 'none' : 1,
            }}
          >
            {item.title}
          </StyledDvtContentSubtitleP>
        ))}
      </StyledDvtContentHeader>
      <StyledDvtContentList>
        <StyledDvtContentScroll>
          <StyledDvtContentListUl $column>
            {data.map((item, index) => (
              <StyledContentListLi key={index}>
                <StyledDvtContentListUl>
                  {header.map((hItem, hIndex) => (
                    <StyledContentListLi
                      key={hIndex}
                      style={{
                        width: hItem.width ? hItem.width : 'auto',
                        flex: hItem.width ? 'none' : 1,
                      }}
                    >
                      {hItem.withDateAgo &&
                      typeof item[hItem.field] === 'string' ? (
                        <>{getFormattedDifference(moment(item[hItem.field]))}</>
                      ) : (
                        <>{item[hItem.field]}</>
                      )}
                    </StyledContentListLi>
                  ))}
                </StyledDvtContentListUl>
              </StyledContentListLi>
            ))}
          </StyledDvtContentListUl>
        </StyledDvtContentScroll>
      </StyledDvtContentList>
    </StyledDvtContent>
  );
};

export default DvtContent;
