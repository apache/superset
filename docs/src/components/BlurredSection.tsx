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

const StyledBlurredSection = styled('section')`
  text-align: center;
  border-bottom: 1px solid var(--ifm-border-color);
  overflow: hidden;
  .blur {
    max-width: 635px;
    width: 100%;
    margin-top: -70px;
    margin-bottom: -35px;
    position: relative;
    z-index: -1;
    ${mq[1]} {
      margin-top: -40px;
    }
  }
`;

interface BlurredSectionProps {
  children: ReactNode;
}

const BlurredSection = ({ children }: BlurredSectionProps) => {
  return (
    <StyledBlurredSection>
      {children}
      <img className="blur" src="/img/community/blur.png" alt="Blur" />
    </StyledBlurredSection>
  );
};

export default BlurredSection;
