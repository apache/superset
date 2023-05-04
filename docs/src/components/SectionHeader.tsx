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
import styled from '@emotion/styled';

const StyledSectionHeader = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 55px;
  max-width: 720px;
  margin: 0 auto;
  @media (min-width: 768px) {
    padding-top: 75px;
  }
  .title {
    font-weight: 700;
    color: var(--ifm-font-base-color);
  }
`;

const StyledSectionHeaderH1 = styled(StyledSectionHeader)`
  .title {
    font-size: 64px;
    @media (min-width: 768px) {
      font-size: 96px;
    }
  }
  .line {
    margin-top: -20px;
    margin-bottom: 30px;
    @media (min-width: 768px) {
      margin-top: -45px;
      margin-bottom: 15px;
    }
  }
  .subtitle {
    font-size: 34px;
    line-height: 40px;
    @media (min-width: 768px) {
      font-size: 30px;
    }
  }
`;

const StyledSectionHeaderH2 = styled(StyledSectionHeader)`
  .title {
    font-size: 48px;
  }
  .line {
    margin-top: -15px;
    margin-bottom: 15px;
  }
  .subtitle {
    font-size: 27px;
    line-height: 36px;
    @media (min-width: 768px) {
      font-size: 24px;
      line-height: 32px;
    }
  }
`;

interface SectionHeaderProps {
  level: any;
  title: string;
  subtitle?: string;
}

const SectionHeader = ({ level, title, subtitle }: SectionHeaderProps) => {
  const Heading = level;

  const StyledRoot =
    level === 'h1' ? StyledSectionHeaderH1 : StyledSectionHeaderH2;

  return (
    <StyledRoot>
      <Heading className="title">{title}</Heading>
      <img className="line" src="img/community/line.png" alt="line" />
      {subtitle && <p className="subtitle">{subtitle}</p>}
    </StyledRoot>
  );
};

export default SectionHeader;
