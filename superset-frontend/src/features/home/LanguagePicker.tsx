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
import { MainNav as Menu } from '@superset-ui/core/components/Menu';
import { styled, css, useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';

const { SubMenu } = Menu;
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

const StyledFlag = styled.i`
  margin-top: 2px;
`;

export default function LanguagePicker(props: LanguagePickerProps) {
  const { locale, languages, ...rest } = props;
  const theme = useTheme();
  return (
    <SubMenu
      css={css`
        [data-icon='caret-down'] {
          color: ${theme.colors.grayscale.base};
          font-size: ${theme.fontSizeXS}px;
          margin-left: ${theme.sizeUnit}px;
        }
      `}
      aria-label="Languages"
      title={
        <div className="f16">
          <StyledFlag className={`flag ${languages[locale].flag}`} />
        </div>
      }
      icon={<Icons.CaretDownOutlined iconSize="xs" />}
      {...rest}
    >
      {Object.keys(languages).map(langKey => (
        <Menu.Item
          key={langKey}
          style={{ whiteSpace: 'normal', height: 'auto' }}
        >
          <StyledLabel className="f16">
            <i className={`flag ${languages[langKey].flag}`} />
            <Typography.Link href={languages[langKey].url}>
              {languages[langKey].name}
            </Typography.Link>
          </StyledLabel>
        </Menu.Item>
      ))}
    </SubMenu>
  );
}
