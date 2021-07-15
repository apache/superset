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
import React, {
  ChangeEventHandler,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import Fuse from 'fuse.js';
import {
  t,
  styled,
  css,
  ChartMetadata,
  SupersetTheme,
  useTheme,
} from '@superset-ui/core';
import { Input } from 'src/common/components';
import { usePluginContext } from 'src/components/DynamicPlugins';
import Icons from 'src/components/Icons';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';

interface VizTypeGalleryProps {
  onChange: (vizType: string | null) => void;
  selectedViz: string | null;
  className?: string;
}

type VizEntry = {
  key: string;
  value: ChartMetadata;
};

const DEFAULT_ORDER = [
  'line',
  'big_number',
  'table',
  'filter_box',
  'dist_bar',
  'area',
  'bar',
  'deck_polygon',
  'pie',
  'time_table',
  'pivot_table_v2',
  'histogram',
  'big_number_total',
  'deck_scatter',
  'deck_hex',
  'time_pivot',
  'deck_arc',
  'heatmap',
  'deck_grid',
  'dual_line',
  'deck_screengrid',
  'line_multi',
  'treemap',
  'box_plot',
  'sunburst',
  'sankey',
  'word_cloud',
  'mapbox',
  'kepler',
  'cal_heatmap',
  'rose',
  'bubble',
  'deck_geojson',
  'horizon',
  'deck_multi',
  'compare',
  'partition',
  'event_flow',
  'deck_path',
  'graph_chart',
  'world_map',
  'paired_ttest',
  'para',
  'country_map',
];

const typesWithDefaultOrder = new Set(DEFAULT_ORDER);

const THUMBNAIL_GRID_UNITS = 24;

export const MAX_ADVISABLE_VIZ_GALLERY_WIDTH = 1090;

const OTHER_CATEGORY = t('Other');

export const VIZ_TYPE_CONTROL_TEST_ID = 'viz-type-control';

const VizPickerLayout = styled.div`
  display: grid;
  grid-template-rows: minmax(100px, 1fr) minmax(200px, 35%);
  grid-template-columns: 1fr 5fr;
  grid-template-areas:
    'sidebar main'
    'details details';
  height: 70vh;
  overflow: auto;
`;

const SectionTitle = styled.h3`
  margin-top: 0;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  font-size: ${({ theme }) => theme.typography.sizes.l}px;
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  line-height: ${({ theme }) => theme.gridUnit * 6}px;
`;

const LeftPane = styled.div`
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  overflow: hidden;
`;

const CategoriesWrapper = styled.div`
  display: flex;
  flex-direction: column;
  overflow: auto;
`;

const SearchWrapper = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.gridUnit * 2}px;
    input {
      font-size: ${theme.typography.sizes.s};
    }
    .ant-input-affix-wrapper {
      padding-left: ${theme.gridUnit * 2}px;
    }
  `}
`;

/** Styles to line up prefix/suffix icons in the search input */
const InputIconAlignment = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const CategoryLabel = styled.button`
  ${({ theme }) => `
    all: unset; // remove default button styles
    cursor: pointer;
    padding: ${theme.gridUnit}px;
    border-radius: ${theme.borderRadius}px;
    line-height: 2em;
    font-size: ${theme.typography.sizes.s};

    &:focus {
      outline: initial;
    }

    &.selected {
      background-color: ${theme.colors.secondary.light4};
    }
  `}
`;

const IconsPane = styled.div`
  grid-area: main;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    ${({ theme }) => theme.gridUnit * THUMBNAIL_GRID_UNITS}px
  );
  grid-auto-rows: max-content;
  justify-content: space-evenly;
  grid-gap: ${({ theme }) => theme.gridUnit * 2}px;
  justify-items: center;
  // for some reason this padding doesn't seem to apply at the bottom of the container. Why is a mystery.
  padding: ${({ theme }) => theme.gridUnit * 2}px;
`;

const DetailsPane = (theme: SupersetTheme) => css`
  grid-area: details;
  border-top: 1px solid ${theme.colors.grayscale.light2};
`;

const DetailsPopulated = (theme: SupersetTheme) => css`
  padding: ${theme.gridUnit * 4}px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'viz-name examples-header'
    'description examples';
`;

const DetailsEmpty = (theme: SupersetTheme) => css`
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-style: italic;
  color: ${theme.colors.grayscale.light1};
`;

// overflow hidden on the details pane and overflow auto on the description
// (plus grid layout) enables the description to scroll while the header stays in place.

const Description = styled.p`
  grid-area: description;
  overflow: auto;
  padding-right: ${({ theme }) => theme.gridUnit * 14}px;
`;

const Examples = styled.div`
  grid-area: examples;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  overflow: auto;
  gap: ${({ theme }) => theme.gridUnit * 4}px;

  img {
    height: 100%;
    border-radius: ${({ theme }) => theme.gridUnit}px;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
`;

const thumbnailContainerCss = (theme: SupersetTheme) => css`
  cursor: pointer;
  width: ${theme.gridUnit * THUMBNAIL_GRID_UNITS}px;

  img {
    min-width: ${theme.gridUnit * THUMBNAIL_GRID_UNITS}px;
    min-height: ${theme.gridUnit * THUMBNAIL_GRID_UNITS}px;
    border: 1px solid ${theme.colors.grayscale.light2};
    border-radius: ${theme.gridUnit}px;
    transition: border-color ${theme.transitionTiming};
  }

  &.selected img {
    border: 2px solid ${theme.colors.primary.light2};
  }

  &:hover:not(.selected) img {
    border: 1px solid ${theme.colors.grayscale.light1};
  }

  .viztype-label {
    margin-top: ${theme.gridUnit * 2}px;
    text-align: center;
  }
`;

function vizSortFactor(entry: VizEntry) {
  if (typesWithDefaultOrder.has(entry.key)) {
    return DEFAULT_ORDER.indexOf(entry.key);
  }
  return DEFAULT_ORDER.length;
}

interface ThumbnailProps {
  entry: VizEntry;
  selectedViz: string | null;
  setSelectedViz: (viz: string) => void;
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  entry,
  selectedViz,
  setSelectedViz,
}) => {
  const theme = useTheme();
  const { key, value: type } = entry;
  const isSelected = selectedViz === entry.key;

  return (
    <div
      role="button"
      // using css instead of a styled component to preserve
      // the data-test attribute
      css={thumbnailContainerCss(theme)}
      tabIndex={0}
      className={isSelected ? 'selected' : ''}
      onClick={() => setSelectedViz(key)}
      data-test="viztype-selector-container"
    >
      <img
        alt={type.name}
        width="100%"
        className={`viztype-selector ${isSelected ? 'selected' : ''}`}
        src={type.thumbnail}
      />
      <div
        className="viztype-label"
        data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viztype-label`}
      >
        {type.name}
      </div>
    </div>
  );
};

interface ThumbnailGalleryProps {
  vizEntries: VizEntry[];
  selectedViz: string | null;
  setSelectedViz: (viz: string) => void;
}

/** A list of viz thumbnails, used within the viz picker modal */
const ThumbnailGallery: React.FC<ThumbnailGalleryProps> = ({
  vizEntries,
  ...props
}) => (
  <IconsPane data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viz-row`}>
    {vizEntries.map(entry => (
      <Thumbnail key={entry.key} {...props} entry={entry} />
    ))}
  </IconsPane>
);

const CategorySelector: React.FC<{
  category: string;
  isSelected: boolean;
  onClick: (category: string) => void;
}> = ({ category, isSelected, onClick }) => (
  <CategoryLabel
    key={category}
    name={category}
    className={isSelected ? 'selected' : ''}
    onClick={() => onClick(category)}
  >
    {category}
  </CategoryLabel>
);

const doesVizMatchCategory = (viz: ChartMetadata, category: string) =>
  category === viz.category ||
  (category === OTHER_CATEGORY && viz.category == null);

export default function VizTypeGallery(props: VizTypeGalleryProps) {
  const { selectedViz, onChange, className } = props;
  const { mountedPluginMetadata } = usePluginContext();
  const searchInputRef = useRef<HTMLInputElement>();
  const [searchInputValue, setSearchInputValue] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isActivelySearching = isSearchFocused && !!searchInputValue;

  const selectedVizMetadata: ChartMetadata | null = selectedViz
    ? mountedPluginMetadata[selectedViz]
    : null;

  const chartMetadata: VizEntry[] = useMemo(() => {
    const result = Object.entries(mountedPluginMetadata)
      .map(([key, value]) => ({ key, value }))
      .filter(({ value }) => nativeFilterGate(value.behaviors || []));
    result.sort((a, b) => vizSortFactor(a) - vizSortFactor(b));
    return result;
  }, [mountedPluginMetadata]);

  const chartsByCategory = useMemo(() => {
    const result: Record<string, VizEntry[]> = {};
    chartMetadata.forEach(entry => {
      const category = entry.value.category || OTHER_CATEGORY;
      if (!result[category]) {
        result[category] = [];
      }
      result[category].push(entry);
    });
    return result;
  }, [chartMetadata]);

  const categories = useMemo(
    () =>
      Object.keys(chartsByCategory).sort((a, b) => {
        // make sure Other goes at the end
        if (a === OTHER_CATEGORY) return 1;
        if (b === OTHER_CATEGORY) return -1;
        // sort alphabetically
        return a.localeCompare(b);
      }),
    [chartsByCategory],
  );

  const [activeCategory, setActiveCategory] = useState<string>(
    () => selectedVizMetadata?.category || categories[0],
  );

  // get a fuse instance for fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(chartMetadata, {
        ignoreLocation: true,
        threshold: 0.3,
        keys: ['value.name', 'value.tags', 'value.description'],
      }),
    [chartMetadata],
  );

  const searchResults = useMemo(() => {
    if (searchInputValue.trim() === '') {
      return [];
    }
    return fuse.search(searchInputValue).map(result => result.item);
  }, [searchInputValue, fuse]);

  const focusSearch = useCallback(() => {
    // "start searching" is actually a two-stage process.
    // When you first click on the search bar, the input is focused and nothing else happens.
    // Once you begin typing, the selected category is cleared and the displayed viz entries change.
    setIsSearchFocused(true);
  }, []);

  const changeSearch: ChangeEventHandler<HTMLInputElement> = useCallback(
    event => setSearchInputValue(event.target.value),
    [],
  );

  const stopSearching = useCallback(() => {
    // stopping a search takes you back to the category you were looking at before.
    // Unlike focusSearch, this is a simple one-step process.
    setIsSearchFocused(false);
    setSearchInputValue('');
    searchInputRef.current!.blur();
  }, []);

  const selectCategory = useCallback(
    (key: string) => {
      if (isSearchFocused) {
        stopSearching();
      }
      setActiveCategory(key);
      // clear the selected viz if it is not present in the new category
      const isSelectedVizCompatible =
        selectedVizMetadata && doesVizMatchCategory(selectedVizMetadata, key);
      if (key !== activeCategory && !isSelectedVizCompatible) {
        onChange(null);
      }
    },
    [
      stopSearching,
      isSearchFocused,
      activeCategory,
      selectedVizMetadata,
      onChange,
    ],
  );

  const vizEntriesToDisplay = isActivelySearching
    ? searchResults
    : chartsByCategory[activeCategory] || [];

  return (
    <VizPickerLayout className={className}>
      <LeftPane>
        <SearchWrapper>
          <Input
            type="text"
            ref={searchInputRef as any /* cast required because emotion */}
            value={searchInputValue}
            placeholder={t('Search')}
            onChange={changeSearch}
            onFocus={focusSearch}
            data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__search-input`}
            prefix={
              <InputIconAlignment>
                <Icons.Search iconSize="m" />
              </InputIconAlignment>
            }
            suffix={
              <InputIconAlignment>
                {searchInputValue && (
                  <Icons.XLarge iconSize="m" onClick={stopSearching} />
                )}
              </InputIconAlignment>
            }
          />
        </SearchWrapper>
        <CategoriesWrapper>
          {categories.map(category => (
            <CategorySelector
              key={category}
              category={category}
              isSelected={!isActivelySearching && category === activeCategory}
              onClick={selectCategory}
            />
          ))}
        </CategoriesWrapper>
      </LeftPane>

      <ThumbnailGallery
        vizEntries={vizEntriesToDisplay}
        selectedViz={selectedViz}
        setSelectedViz={onChange}
      />

      {selectedVizMetadata ? (
        <div
          css={(theme: SupersetTheme) => [
            DetailsPane(theme),
            DetailsPopulated(theme),
          ]}
        >
          <>
            <SectionTitle
              css={css`
                grid-area: viz-name;
              `}
            >
              {selectedVizMetadata?.name}
            </SectionTitle>
            <Description>
              {selectedVizMetadata?.description ||
                t('No description available.')}
            </Description>
            <SectionTitle
              css={css`
                grid-area: examples-header;
              `}
            >
              {!!selectedVizMetadata?.exampleGallery?.length && t('Examples')}
            </SectionTitle>
            <Examples>
              {(selectedVizMetadata?.exampleGallery || []).map(example => (
                <img
                  src={example.url}
                  alt={example.caption}
                  title={example.caption}
                />
              ))}
            </Examples>
          </>
        </div>
      ) : (
        <div
          css={(theme: SupersetTheme) => [
            DetailsPane(theme),
            DetailsEmpty(theme),
          ]}
        >
          {t('Select a visualization type')}
        </div>
      )}
    </VizPickerLayout>
  );
}
