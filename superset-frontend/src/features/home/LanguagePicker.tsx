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
import { useMemo } from 'react';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { styled, t } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';

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

const StyledLabel = styled.div`
  display: flex;
  align-items: center;

  & i {
    margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
  }

  & a {
    display: block;
    width: 150px;
    word-wrap: break-word;
    text-decoration: none;
  }
`;

export const useLanguageMenuItems = ({
  locale,
  languages,
}: LanguagePickerProps): MenuItem =>
  useMemo(() => {
    const items: MenuItem[] = Object.keys(languages).map(langKey => ({
      key: langKey,
      label: (
        <StyledLabel className="f16">
          <i className={`flag ${languages[langKey].flag}`} />
          <Typography.Link href={languages[langKey].url}>
            {languages[langKey].name}
          </Typography.Link>
        </StyledLabel>
      ),
      style: { whiteSpace: 'normal', height: 'auto' },
    }));

    return {
      key: 'language-submenu',
      type: 'submenu' as const,
      label: (
        <span className="f16" aria-label={t('Languages')}>
          <i className={`flag ${languages[locale].flag}`} />
        </span>
      ),
      icon: <Icons.CaretDownOutlined iconSize="xs" />,
      children: items,
      className: 'submenu-with-caret',
      popupClassName: 'language-picker-popup',
    };
  }, [languages, locale]);
