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
import { styled, t } from '@superset-ui/core';
import { Tag } from 'src/components';
import Icons from 'src/components/Icons';
import { DashboardTemplate } from './types';

const Tile = styled.button`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.gridUnit}px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary.base};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.base};
    outline-offset: 2px;
  }
`;

const ThumbnailWrapper = styled.div`
  width: 100%;
  height: 180px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  border-radius: ${({ theme }) => theme.gridUnit}px;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.grayscale.light3};
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
  gap: ${({ theme }) => theme.gridUnit}px;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
`;

const Title = styled.div`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  text-align: left;
  flex: 1;
`;

const Description = styled.p`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
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
  gap: ${({ theme }) => theme.gridUnit}px;
  margin-top: auto;
`;

interface DashboardTemplateTileProps {
  template: DashboardTemplate;
  onClick: (template: DashboardTemplate) => void;
}

export const DashboardTemplateTile: React.FC<DashboardTemplateTileProps> = ({
  template,
  onClick,
}) => {
  const isBlank = template.id === null;

  return (
    <Tile
      onClick={() => onClick(template)}
      aria-label={template.dashboard_title}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(template);
        }
      }}
    >
      <ThumbnailWrapper>
        {template.template_thumbnail_url ? (
          <ThumbnailImage
            src={template.template_thumbnail_url}
            alt={template.dashboard_title}
          />
        ) : (
          <Icons.DashboardOutlined iconSize="xxl" iconColor="grayscale.light1" />
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
    </Tile>
  );
};
