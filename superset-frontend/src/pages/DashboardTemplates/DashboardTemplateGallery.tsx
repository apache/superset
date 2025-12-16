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

import React, { useMemo, useState, useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import Fuse from 'fuse.js';
import { Input } from 'src/components';
import Icons from 'src/components/Icons';
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
  grid-template-rows: auto minmax(100px, 1fr);
  grid-template-columns: minmax(14em, auto) 5fr;
  grid-template-areas:
    'sidebar search'
    'sidebar main';
  height: 70vh;
  overflow: auto;
  background: ${({ theme }) => theme.colors.grayscale.light4};
`;

const LeftPane = styled.div`
  grid-area: sidebar;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.grayscale.light5};
`;

const SearchWrapper = styled.div`
  grid-area: search;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  background: ${({ theme }) => theme.colors.grayscale.light5};
`;

const MainContent = styled.div`
  grid-area: main;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  overflow-y: auto;
`;

const TileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.gridUnit * 4}px;
`;

const Selector = styled.button<{ isSelected: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
  border: none;
  border-radius: ${({ theme }) => theme.gridUnit}px;
  background: ${({ theme, isSelected }) =>
    isSelected ? theme.colors.primary.light4 : 'transparent'};
  color: ${({ theme, isSelected }) =>
    isSelected ? theme.colors.primary.dark1 : theme.colors.grayscale.dark1};
  font-weight: ${({ theme, isSelected }) =>
    isSelected
      ? theme.typography.weights.bold
      : theme.typography.weights.normal};
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.primary.light5};
  }
`;

const SectionTitle = styled.div`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  margin-top: ${({ theme }) => theme.gridUnit * 3}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};

  &:first-child {
    margin-top: 0;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.gridUnit * 8}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

export const DashboardTemplateGallery: React.FC<
  DashboardTemplateGalleryProps
> = ({ templates, loading, onSelectTemplate }) => {
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    [],
  );

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  if (loading) {
    return <div>{t('Loading templates...')}</div>;
  }

  return (
    <GalleryLayout>
      {/* Left sidebar with category filters */}
      <LeftPane>
        <Selector
          isSelected={selectedCategory === ALL_TEMPLATES}
          onClick={() => setSelectedCategory(ALL_TEMPLATES)}
        >
          {ALL_TEMPLATES}
        </Selector>

        <Selector
          isSelected={selectedCategory === FEATURED}
          onClick={() => setSelectedCategory(FEATURED)}
        >
          <Icons.StarFilled iconSize="m" /> {FEATURED}
        </Selector>

        {categories.length > 0 && (
          <>
            <SectionTitle>{t('Categories')}</SectionTitle>
            {categories.map(category => (
              <Selector
                key={category}
                isSelected={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
              >
                {category} ({templatesByCategory[category].length})
              </Selector>
            ))}
          </>
        )}
      </LeftPane>

      {/* Search bar */}
      <SearchWrapper>
        <Input
          placeholder={t('Search templates...')}
          value={searchTerm}
          onChange={handleSearchChange}
          prefix={<Icons.SearchOutlined />}
          suffix={
            searchTerm && (
              <Icons.CloseOutlined
                onClick={clearSearch}
                style={{ cursor: 'pointer' }}
              />
            )
          }
          allowClear
        />
      </SearchWrapper>

      {/* Main content with template tiles */}
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
          <EmptyState>
            {t('No templates found matching your search.')}
          </EmptyState>
        )}
      </MainContent>
    </GalleryLayout>
  );
};
