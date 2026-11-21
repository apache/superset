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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { SubjectType } from 'src/types/Subject';

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

  .ant-select-selection-item & {
    display: none;
  }
`;

const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  [SubjectType.User]: t('User'),
  [SubjectType.Role]: t('Role'),
  [SubjectType.Group]: t('Group'),
};

export const SUBJECT_TEXT_LABEL_PROP = 'textLabel';
export const SUBJECT_DETAIL_PROP = 'subjectDetail';
export const SUBJECT_OPTION_FILTER_PROPS = [
  SUBJECT_TEXT_LABEL_PROP,
  SUBJECT_DETAIL_PROP,
];

export const SubjectSelectLabel = ({
  label,
  type,
  secondaryLabel,
}: {
  label: string;
  type?: SubjectType;
  secondaryLabel?: string;
}) => {
  const typeLabel = type != null ? SUBJECT_TYPE_LABELS[type] : undefined;
  const detail = secondaryLabel
    ? typeLabel
      ? `${typeLabel} · ${secondaryLabel}`
      : secondaryLabel
    : typeLabel;

  return (
    <StyledLabelContainer>
      <StyledLabel>{label}</StyledLabel>
      {detail && <StyledLabelDetail>{detail}</StyledLabelDetail>}
    </StyledLabelContainer>
  );
};
