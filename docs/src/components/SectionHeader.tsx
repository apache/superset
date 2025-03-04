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
import { ReactNode } from 'react';
import styled from '@emotion/styled';
import { mq } from '../utils';

type StyledSectionHeaderProps = {
  dark: boolean;
};

const StyledSectionHeader = styled('div')<StyledSectionHeaderProps>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 75px 20px 0;
  max-width: 720px;
  margin: 0 auto;
  ${mq[1]} {
    padding-top: 55px;
  }
  .title,
  .subtitle {
    color: ${props =>
      props.dark
        ? 'var(--ifm-font-base-color-inverse)'
        : 'var(--ifm-font-base-color)'};
  }
`;

const StyledSectionHeaderH1 = styled(StyledSectionHeader)`
  .title {
    font-size: 96px;
    ${mq[1]} {
      font-size: 46px;
    }
  }
  .line {
    margin-top: -45px;
    margin-bottom: 15px;
    ${mq[1]} {
      margin-top: -20px;
      margin-bottom: 30px;
    }
  }
  .subtitle {
    font-size: 30px;
    line-height: 40px;
    ${mq[1]} {
      font-size: 25px;
      line-height: 29px;
    }
  }
`;

const StyledSectionHeaderH2 = styled(StyledSectionHeader)`
  .title {
    font-size: 48px;
    ${mq[1]} {
      font-size: 34px;
    }
  }
  .line {
    margin-top: -15px;
    margin-bottom: 15px;
    ${mq[1]} {
      margin-top: -5px;
    }
  }
  .subtitle {
    font-size: 24px;
    line-height: 32px;
    ${mq[1]} {
      font-size: 18px;
      line-height: 26px;
    }
  }
`;

interface SectionHeaderProps {
  level: 'h1' | 'h2';
  title: string;
  subtitle?: string | ReactNode;
  dark?: boolean;
}

const SectionHeader = ({
  level,
  title,
  subtitle,
  dark,
}: SectionHeaderProps) => {
  const Heading = level;

  const StyledRoot =
    level === 'h1' ? StyledSectionHeaderH1 : StyledSectionHeaderH2;

  return (
    <StyledRoot dark={!!dark}>
      <Heading className="title">{title}</Heading>
      <img className="line" src="/img/community/line.png" alt="line" />
      {subtitle && <p className="subtitle">{subtitle}</p>}
    </StyledRoot>
  );
};

export default SectionHeader;
