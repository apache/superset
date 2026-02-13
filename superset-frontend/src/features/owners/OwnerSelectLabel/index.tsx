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
import { styled } from '@apache-superset/core/ui';

const StyledLabelContainer = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
`;

const StyledLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
`;

const StyledLabelDetail = styled.span`
  ${({ theme: { fontSizeSM, colorTextSecondary } }) => `
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: ${fontSizeSM}px;
    color: ${colorTextSecondary};
    line-height: 1.6;
    display: block;
  `}
`;

export const OWNER_TEXT_LABEL_PROP = 'textLabel';
export const OWNER_EMAIL_PROP = 'ownerEmail';
export const OWNER_OPTION_FILTER_PROPS = [
  OWNER_TEXT_LABEL_PROP,
  OWNER_EMAIL_PROP,
];

export const OwnerSelectLabel = ({
  name,
  email,
}: {
  name: string;
  email?: string;
}) => (
  <StyledLabelContainer>
    <StyledLabel>{name}</StyledLabel>
    {email && <StyledLabelDetail>{email}</StyledLabelDetail>}
  </StyledLabelContainer>
);
