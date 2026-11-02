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
import { FC } from 'react';
import { css, styled } from '@apache-superset/core/theme';
import { SafeMarkdown } from '@superset-ui/core/components';

const SliceInfoContainer = styled.div`
  ${({ theme }) => css`
    max-width: 350px;
    max-height: 400px;
    overflow-y: auto;
    overflow-x: auto;
    font-size: ${theme.fontSize}px;
  `}
`;

interface SliceInfoProps {
  slice: {
    description: string;
  };
}

const SliceInfo: FC<SliceInfoProps> = ({ slice }) => (
  <SliceInfoContainer>
    <SafeMarkdown source={slice.description} />
  </SliceInfoContainer>
);

export default SliceInfo;
