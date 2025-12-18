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

import { FC, ChangeEvent, useMemo, useState, useCallback } from 'react';
import Fuse from 'fuse.js';
import { t } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import { AIInfoBanner, Input, Collapse } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { DashboardTemplateTile } from './DashboardTemplateTile';
import {
  BLANK_TEMPLATE,
  FEATURED,
  ALL_TEMPLATES,
  OTHER_CATEGORY,
} from './constants';
import { DashboardTemplate, DashboardTemplateGalleryProps } from './types';

const GalleryLayout = styled.div`
  display: grid;
  grid-template-rows: auto auto minmax(100px, 1fr);
  grid-template-columns: minmax(14em, auto) 5fr;
  grid-template-areas:
    'sidebar search'
    'sidebar banner'
    'sidebar main';
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: ${({ theme }) => theme.colorBgLayout};
`;

const LeftPane = styled.div`
  ${({ theme }) => css`
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    border-right: 1px solid ${theme.colorBorder};
    overflow: auto;

    .ant-collapse .ant-collapse-item {
      .ant-collapse-header {
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorText};
        padding-left: ${theme.sizeUnit * 2}px;
        padding-bottom: ${theme.sizeUnit}px;
      }

      .ant-collapse-content .ant-collapse-content-box {
        display: flex;
        flex-direction: column;
        padding: 0 ${theme.sizeUnit * 2}px;
      }
    }
  `}
`;

const SearchWrapper = styled.div`
  ${({ theme }) => css`
    grid-area: search;
    margin-top: ${theme.sizeUnit * 3}px;
    margin-bottom: ${theme.sizeUnit}px;
    margin-left: ${theme.sizeUnit * 3}px;
    margin-right: ${theme.sizeUnit * 3}px;
    .ant-input-affix-wrapper {
      padding-left: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const AIBannerWrapper = styled.div`
  ${({ theme }) => css`
    grid-area: banner;
    margin-top: ${theme.sizeUnit * 2}px;
    padding: 0 ${theme.sizeUnit * 3}px ${theme.sizeUnit * 2}px;
  `}
`;

const MainContent = styled.div`
  grid-area: main;
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
  overflow-y: auto;
`;

const TileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const SelectorLabel = styled.button`
  ${({ theme }) => css`
    all: unset;
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    margin: ${theme.sizeUnit}px 0;
    padding: 0 ${theme.sizeUnit}px;
    border-radius: ${theme.borderRadius}px;
    line-height: 2em;
    text-overflow: ellipsis;
    white-space: nowrap;
    position: relative;
    color: ${theme.colorText};

    &:focus {
      outline: initial;
    }

    &.selected {
      background-color: ${theme.colorPrimary};
      color: ${theme.colorTextLightSolid};

      svg {
        color: ${theme.colorTextLightSolid};
      }
    }

    & > span[role='img'] {
      margin-right: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const NoResultsMessage = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.sizeUnit * 8}px;
  color: ${({ theme }) => theme.colorTextTertiary};
`;

const InputIconAlignment = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${({ theme }) => theme.colorIcon};
`;

export const DashboardTemplateGallery: FC<DashboardTemplateGalleryProps> = ({
  templates,
  loading,
  onSelectTemplate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_TEMPLATES);

  // Always prepend "Start from blank" as first item
  const templatesWithBlank = useMemo(
    () => [BLANK_TEMPLATE, ...templates],
    [templates],
  );

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, DashboardTemplate[]> = {};
    templates.forEach(template => {
      const cat = template.template_category || OTHER_CATEGORY;
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(template);
    });
    return grouped;
  }, [templates]);

  // Get sorted category list
  const categories = useMemo(() => {
    const cats = Object.keys(templatesByCategory).sort();
    // Move "Other" to end if it exists
    const otherIndex = cats.indexOf(OTHER_CATEGORY);
    if (otherIndex > -1) {
      cats.splice(otherIndex, 1);
      cats.push(OTHER_CATEGORY);
    }
    return cats;
  }, [templatesByCategory]);

  // Setup Fuse.js for fuzzy search (existing pattern from Chart Gallery)
  const fuse = useMemo(
    () =>
      new Fuse(templates, {
        keys: [
          { name: 'dashboard_title', weight: 4 },
          { name: 'template_description', weight: 1 },
        ],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [templates],
  );

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let result = templatesWithBlank;

    // Apply search (skip blank template in search)
    if (searchTerm) {
      const searchResults = fuse.search(searchTerm).map(r => r.item);
      result = [BLANK_TEMPLATE, ...searchResults];
    }

    // Apply category filter
    if (selectedCategory === FEATURED) {
      result = result.filter(t => t.id === null || t.is_featured_template);
    } else if (selectedCategory !== ALL_TEMPLATES) {
      result = result.filter(
        t => t.id === null || t.template_category === selectedCategory,
      );
    }

    return result;
  }, [templatesWithBlank, searchTerm, selectedCategory, fuse]);

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    [],
  );

  const stopSearching = useCallback(() => {
    setSearchTerm('');
  }, []);

  if (loading) {
    return <div>{t('Loading templates...')}</div>;
  }

  return (
    <GalleryLayout>
      <LeftPane aria-label={t('Choose template type')} role="tablist">
        <SelectorLabel
          css={({ sizeUnit }) => css`
            margin: ${sizeUnit * 2}px;
            margin-bottom: 0;
          `}
          className={selectedCategory === ALL_TEMPLATES ? 'selected' : ''}
          onClick={() => setSelectedCategory(ALL_TEMPLATES)}
          tabIndex={0}
          role="tab"
          aria-selected={selectedCategory === ALL_TEMPLATES}
        >
          <Icons.Ballot iconSize="m" />
          {ALL_TEMPLATES}
        </SelectorLabel>

        <SelectorLabel
          css={({ sizeUnit }) => css`
            margin: ${sizeUnit * 2}px;
            margin-bottom: 0;
          `}
          className={selectedCategory === FEATURED ? 'selected' : ''}
          onClick={() => setSelectedCategory(FEATURED)}
          tabIndex={0}
          role="tab"
          aria-selected={selectedCategory === FEATURED}
        >
          <Icons.FireOutlined iconSize="m" />
          {FEATURED}
        </SelectorLabel>

        {categories.length > 0 && (
          <Collapse
            expandIconPosition="end"
            ghost
            defaultActiveKey="categories"
            items={[
              {
                key: 'categories',
                label: <span className="header">{t('Categories')}</span>,
                children: (
                  <>
                    {categories.map(category => (
                      <SelectorLabel
                        key={category}
                        className={
                          selectedCategory === category ? 'selected' : ''
                        }
                        onClick={() => setSelectedCategory(category)}
                        tabIndex={0}
                        role="tab"
                        aria-selected={selectedCategory === category}
                      >
                        <Icons.Category iconSize="m" />
                        {category} ({templatesByCategory[category].length})
                      </SelectorLabel>
                    ))}
                  </>
                ),
              },
            ]}
          />
        )}
      </LeftPane>

      <SearchWrapper>
        <Input
          type="text"
          value={searchTerm}
          placeholder={t('Search templates...')}
          onChange={handleSearchChange}
          prefix={
            <InputIconAlignment>
              <Icons.SearchOutlined iconSize="m" />
            </InputIconAlignment>
          }
          suffix={
            <InputIconAlignment>
              {searchTerm && (
                <Icons.CloseOutlined iconSize="m" onClick={stopSearching} />
              )}
            </InputIconAlignment>
          }
        />
      </SearchWrapper>

      <AIBannerWrapper>
        <AIInfoBanner
          text={t(
            'Start from scratch with a blank dashboard, or pick a template from your preferred category to build a fully-functional dashboard connected to one of your database connections in no time.',
          )}
          data-test="templates-ai-hint"
        />
      </AIBannerWrapper>

      <MainContent>
        <TileGrid>
          {filteredTemplates.map(template => (
            <DashboardTemplateTile
              key={template.uuid}
              template={template}
              onClick={onSelectTemplate}
            />
          ))}
        </TileGrid>
        {filteredTemplates.length === 0 && (
          <NoResultsMessage>
            {t('No templates found matching your search.')}
          </NoResultsMessage>
        )}
      </MainContent>
    </GalleryLayout>
  );
};
