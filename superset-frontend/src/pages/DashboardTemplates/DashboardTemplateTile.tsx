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

import { FC, KeyboardEvent } from 'react';
import { t } from '@superset-ui/core';
import { styled, css, SupersetTheme } from '@apache-superset/core/ui';
import { Tag, Card } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { DashboardTemplate } from './types';

const THUMBNAIL_HEIGHT = 180;

const StyledCard = styled(Card)`
  ${({ theme }) => css`
    overflow: hidden;
    cursor: pointer;

    &:hover {
      box-shadow: ${theme.boxShadow};
      transition: box-shadow ${theme.motionDurationSlow} ease-in-out;
    }

    .ant-card-body {
      padding: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const ThumbnailWrapper = styled.div`
  width: 100%;
  height: ${THUMBNAIL_HEIGHT}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  overflow: hidden;
  background: ${({ theme }) => theme.colorFillTertiary};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const Title = styled.div`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSize}px;
  color: ${({ theme }) => theme.colorText};
  text-align: left;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Description = styled.p`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const TagsWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit}px;
  margin-top: auto;
`;

interface DashboardTemplateTileProps {
  template: DashboardTemplate;
  onClick: (template: DashboardTemplate) => void;
}

export const DashboardTemplateTile: FC<DashboardTemplateTileProps> = ({
  template,
  onClick,
}) => {
  const isBlank = template.id === null;

  const handleClick = () => onClick(template);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(template);
    }
  };

  return (
    <StyledCard
      onClick={handleClick}
      aria-label={template.dashboard_title}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <ThumbnailWrapper>
        {template.template_thumbnail_url ? (
          <ThumbnailImage
            src={template.template_thumbnail_url}
            alt={template.dashboard_title}
          />
        ) : (
          <Icons.DashboardOutlined
            iconSize="xxl"
            css={(theme: SupersetTheme) => css`
              color: ${theme.colorTextQuaternary};
            `}
          />
        )}
      </ThumbnailWrapper>

      <TitleRow>
        <Title>{template.dashboard_title}</Title>
        {template.is_featured_template && !isBlank && (
          <Tag>{t('Featured')}</Tag>
        )}
      </TitleRow>

      {template.template_description && (
        <Description>{template.template_description}</Description>
      )}

      {template.template_tags && template.template_tags.length > 0 && (
        <TagsWrapper>
          {template.template_tags.map(tag => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </TagsWrapper>
      )}
    </StyledCard>
  );
};
