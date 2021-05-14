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
import { Select } from 'src/common/components';
import { styled, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';

export interface Languages {
  [key: string]: {
    flag: string;
    url: string;
    name: string;
  };
}

interface LanguagePickerProps {
  locale: string;
  languages: Languages;
}

const dropdownWidth = 150;

const StyledLabel = styled.div`
  display: flex;
  align-items: center;

  & i {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }

  & span {
    display: block;
    width: ${dropdownWidth}px;
    word-wrap: break-word;
    white-space: normal;
  }
`;

const StyledFlag = styled.div`
  margin-top: 2px;
`;

const StyledIcon = styled(Icons.TriangleDown)`
  ${({ theme }) => `
    margin-top: -${theme.gridUnit}px;
    margin-left: -${theme.gridUnit * 2}px;
  `}
`;

export default function LanguagePicker({
  locale,
  languages,
}: LanguagePickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const options = Object.keys(languages).map(langKey => ({
    label: (
      <StyledLabel className="f16">
        <i className={`flag ${languages[langKey].flag}`} />{' '}
        <span>{languages[langKey].name}</span>
      </StyledLabel>
    ),
    value: langKey,
    flag: (
      <StyledFlag className="f16">
        <i className={`flag ${languages[langKey].flag}`} />
      </StyledFlag>
    ),
  }));

  return (
    <Select
      defaultValue={locale}
      open={open}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onDropdownVisibleChange={open => setOpen(open)}
      bordered={false}
      options={options}
      suffixIcon={
        <StyledIcon
          iconColor={theme.colors.grayscale.base}
          className="ant-select-suffix"
        />
      }
      listHeight={400}
      dropdownAlign={{
        offset: [-dropdownWidth, 0],
      }}
      optionLabelProp="flag"
      dropdownMatchSelectWidth={false}
      onChange={(value: string) => {
        window.location.href = languages[value].url;
      }}
    />
  );
}
