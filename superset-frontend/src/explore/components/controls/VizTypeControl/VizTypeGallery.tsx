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
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Fuse from 'fuse.js';
import cx from 'classnames';
import {
  t,
  styled,
  css,
  ChartMetadata,
  SupersetTheme,
  useTheme,
  chartLabelWeight,
  chartLabelExplanations,
} from '@superset-ui/core';
import { AntdCollapse } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import { Input } from 'src/components/Input';
import Label from 'src/components/Label';
import { usePluginContext } from 'src/components/DynamicPlugins';
import Icons from 'src/components/Icons';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import scrollIntoView from 'scroll-into-view-if-needed';

interface VizTypeGalleryProps {
  onChange: (vizType: string | null) => void;
  onDoubleClick: () => void;
  selectedViz: string | null;
  className?: string;
  denyList: string[];
}

type VizEntry = {
  key: string;
  value: ChartMetadata;
};

enum SECTIONS {
  ALL_CHARTS = 'ALL_CHARTS',
  CATEGORY = 'CATEGORY',
  TAGS = 'TAGS',
  RECOMMENDED_TAGS = 'RECOMMENDED_TAGS',
}

const DEFAULT_ORDER = [
  'line',
  'big_number',
  'big_number_total',
  'table',
  'pivot_table_v2',
  'echarts_timeseries_line',
  'echarts_area',
  'echarts_timeseries_bar',
  'echarts_timeseries_scatter',
  'pie',
  'mixed_timeseries',
  'filter_box',
  'dist_bar',
  'area',
  'bar',
  'deck_polygon',
  'time_table',
  'histogram',
  'deck_scatter',
  'deck_hex',
  'time_pivot',
  'deck_arc',
  'heatmap',
  'deck_grid',
  'deck_screengrid',
  'treemap_v2',
  'box_plot',
  'sunburst',
  'sankey',
  'word_cloud',
  'mapbox',
  'kepler',
  'cal_heatmap',
  'rose',
  'bubble',
  'bubble_v2',
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

const ALL_CHARTS = t('All charts');

const RECOMMENDED_TAGS = [t('Popular'), t('ECharts'), t('Advanced-Analytics')];

export const VIZ_TYPE_CONTROL_TEST_ID = 'viz-type-control';

const VizPickerLayout = styled.div<{ isSelectedVizMetadata: boolean }>`
  ${({ isSelectedVizMetadata }) => `
    display: grid;
    grid-template-rows: ${
      isSelectedVizMetadata
        ? `auto minmax(100px, 1fr) minmax(200px, 35%)`
        : 'auto minmax(100px, 1fr)'
    };
    // em is used here because the sidebar should be sized to fit the longest standard tag
    grid-template-columns: minmax(14em, auto) 5fr;
    grid-template-areas:
      'sidebar search'
      'sidebar main'
      'details details';
    height: 70vh;
    overflow: auto;
  `}
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
  overflow: auto;

  .ant-collapse .ant-collapse-item {
    .ant-collapse-header {
      font-size: ${({ theme }) => theme.typography.sizes.s}px;
      color: ${({ theme }) => theme.colors.grayscale.base};
      padding-left: ${({ theme }) => theme.gridUnit * 2}px;
      padding-bottom: ${({ theme }) => theme.gridUnit}px;
    }
    .ant-collapse-content .ant-collapse-content-box {
      display: flex;
      flex-direction: column;
      padding: 0 ${({ theme }) => theme.gridUnit * 2}px;
    }
  }
`;

const RightPane = styled.div`
  grid-area: main;
  overflow-y: auto;
`;

const SearchWrapper = styled.div`
  ${({ theme }) => `
    grid-area: search;
    margin-top: ${theme.gridUnit * 3}px;
    margin-bottom: ${theme.gridUnit}px;
    margin-left: ${theme.gridUnit * 3}px;
    margin-right: ${theme.gridUnit * 3}px;
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

const SelectorLabel = styled.button`
  ${({ theme }) => `
    all: unset; // remove default button styles
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    margin: ${theme.gridUnit}px 0;
    padding: 0 ${theme.gridUnit}px;
    border-radius: ${theme.borderRadius}px;
    line-height: 2em;
    text-overflow: ellipsis;
    white-space: nowrap;
    position: relative;

    &:focus {
      outline: initial;
    }

    &.selected {
      background-color: ${theme.colors.primary.base};
      color: ${theme.colors.primary.light5};

      svg {
        color: ${theme.colors.primary.light5};
      }

      &:hover {
        .cancel {
          visibility: visible;
        }
      }
    }

    & span:first-of-type svg {
      margin-top: ${theme.gridUnit * 1.5}px;
    }

    .cancel {
      visibility: hidden;
    }
  `}
`;

const IconsPane = styled.div`
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
  grid-template-rows: auto auto 1fr;
  grid-template-areas:
    'viz-name examples-header'
    'viz-tags examples'
    'description examples';
`;

// overflow hidden on the details pane and overflow auto on the description
// (plus grid layout) enables the description to scroll while the header stays in place.
const TagsWrapper = styled.div`
  grid-area: viz-tags;
  width: ${({ theme }) => theme.gridUnit * 120}px;
  padding-right: ${({ theme }) => theme.gridUnit * 14}px;
  padding-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

const Description = styled.p`
  grid-area: description;
  overflow: auto;
  padding-right: ${({ theme }) => theme.gridUnit * 14}px;
  margin: 0;
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
  position: relative;

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

const HighlightLabel = styled.div`
  ${({ theme }) => `
    border: 1px solid ${theme.colors.primary.dark1};
    box-sizing: border-box;
    border-radius: ${theme.gridUnit}px;
    background: ${theme.colors.grayscale.light5};
    line-height: ${theme.gridUnit * 2.5}px;
    color: ${theme.colors.primary.dark1};
    font-size: ${theme.typography.sizes.s}px;
    font-weight: ${theme.typography.weights.bold};
    text-align: center;
    padding: ${theme.gridUnit * 0.5}px ${theme.gridUnit}px;
    text-transform: uppercase;
    cursor: pointer;

    div {
      transform: scale(0.83,0.83);
    }
  `}
`;

const ThumbnailLabelWrapper = styled.div`
  position: absolute;
  right: ${({ theme }) => theme.gridUnit}px;
  top: ${({ theme }) => theme.gridUnit * 19}px;
`;

const TitleLabelWrapper = styled.div`
  display: inline-block !important;
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
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
  onDoubleClick: () => void;
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  entry,
  selectedViz,
  setSelectedViz,
  onDoubleClick,
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
      onDoubleClick={onDoubleClick}
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
      {type.label && (
        <ThumbnailLabelWrapper>
          <HighlightLabel>
            <div>{t(type.label)}</div>
          </HighlightLabel>
        </ThumbnailLabelWrapper>
      )}
    </div>
  );
};

interface ThumbnailGalleryProps {
  vizEntries: VizEntry[];
  selectedViz: string | null;
  setSelectedViz: (viz: string) => void;
  onDoubleClick: () => void;
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

const Selector: React.FC<{
  selector: string;
  sectionId: string;
  icon: JSX.Element;
  isSelected: boolean;
  onClick: (selector: string, sectionId: string) => void;
  className?: string;
}> = ({ selector, sectionId, icon, isSelected, onClick, className }) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  // see Element.scrollIntoViewIfNeeded()
  // see: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoViewIfNeeded
  useEffect(() => {
    if (isSelected) {
      // We need to wait for the modal to open and then scroll, so we put it in the microtask queue
      queueMicrotask(() =>
        scrollIntoView(btnRef.current as HTMLButtonElement, {
          behavior: 'smooth',
          scrollMode: 'if-needed',
        }),
      );
    }
  }, []);

  return (
    <SelectorLabel
      ref={btnRef}
      key={selector}
      name={selector}
      className={cx(className, isSelected && 'selected')}
      onClick={() => onClick(selector, sectionId)}
    >
      {icon}
      {selector}
    </SelectorLabel>
  );
};

const doesVizMatchSelector = (viz: ChartMetadata, selector: string) =>
  selector === viz.category ||
  (selector === OTHER_CATEGORY && viz.category == null) ||
  (viz.tags || []).indexOf(selector) > -1;

export default function VizTypeGallery(props: VizTypeGalleryProps) {
  const { selectedViz, onChange, onDoubleClick, className } = props;
  const { mountedPluginMetadata } = usePluginContext();
  const searchInputRef = useRef<HTMLInputElement>();
  const [searchInputValue, setSearchInputValue] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(true);
  const isActivelySearching = isSearchFocused && !!searchInputValue;

  const selectedVizMetadata: ChartMetadata | null = selectedViz
    ? mountedPluginMetadata[selectedViz]
    : null;

  const chartMetadata: VizEntry[] = useMemo(() => {
    const result = Object.entries(mountedPluginMetadata)
      .map(([key, value]) => ({ key, value }))
      .filter(({ key }) => !props.denyList.includes(key))
      .filter(
        ({ value }) =>
          nativeFilterGate(value.behaviors || []) && !value.deprecated,
      );
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

  const chartsByTags = useMemo(() => {
    const result: Record<string, VizEntry[]> = {};
    chartMetadata.forEach(entry => {
      const tags = entry.value.tags || [];
      tags.forEach(tag => {
        if (!result[tag]) {
          result[tag] = [];
        }
        result[tag].push(entry);
      });
    });
    return result;
  }, [chartMetadata]);

  const tags = useMemo(
    () =>
      Object.keys(chartsByTags)
        .sort((a, b) =>
          // sort alphabetically
          a.localeCompare(b),
        )
        .filter(tag => RECOMMENDED_TAGS.indexOf(tag) === -1),
    [chartsByTags],
  );

  const sortedMetadata = useMemo(
    () => chartMetadata.sort((a, b) => a.key.localeCompare(b.key)),
    [chartMetadata],
  );

  const [activeSelector, setActiveSelector] = useState<string>(
    () => selectedVizMetadata?.category || RECOMMENDED_TAGS[0],
  );

  const [activeSection, setActiveSection] = useState<string>(() =>
    selectedVizMetadata?.category
      ? SECTIONS.CATEGORY
      : SECTIONS.RECOMMENDED_TAGS,
  );

  // get a fuse instance for fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(chartMetadata, {
        ignoreLocation: true,
        threshold: 0.3,
        keys: [
          {
            name: 'value.name',
            weight: 4,
          },
          {
            name: 'value.tags',
            weight: 2,
          },
          'value.description',
        ],
      }),
    [chartMetadata],
  );

  const searchResults = useMemo(() => {
    if (searchInputValue.trim() === '') {
      return [];
    }
    return fuse
      .search(searchInputValue)
      .map(result => result.item)
      .sort((a, b) => {
        const aLabel = a.value?.label;
        const bLabel = b.value?.label;
        const aOrder =
          aLabel && chartLabelWeight[aLabel]
            ? chartLabelWeight[aLabel].weight
            : 0;
        const bOrder =
          bLabel && chartLabelWeight[bLabel]
            ? chartLabelWeight[bLabel].weight
            : 0;
        return bOrder - aOrder;
      });
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

  const clickSelector = useCallback(
    (selector: string, sectionId: string) => {
      if (isSearchFocused) {
        stopSearching();
      }
      setActiveSelector(selector);
      setActiveSection(sectionId);
      // clear the selected viz if it is not present in the new category or tags
      const isSelectedVizCompatible =
        selectedVizMetadata &&
        doesVizMatchSelector(selectedVizMetadata, selector);
      if (selector !== activeSelector && !isSelectedVizCompatible) {
        onChange(null);
      }
    },
    [
      stopSearching,
      isSearchFocused,
      activeSelector,
      selectedVizMetadata,
      onChange,
    ],
  );

  const sectionMap = useMemo(
    () => ({
      [SECTIONS.RECOMMENDED_TAGS]: {
        title: t('Recommended tags'),
        icon: <Icons.Tags />,
        selectors: RECOMMENDED_TAGS,
      },
      [SECTIONS.CATEGORY]: {
        title: t('Category'),
        icon: <Icons.Category />,
        selectors: categories,
      },
      [SECTIONS.TAGS]: {
        title: t('Tags'),
        icon: <Icons.Tags />,
        selectors: tags,
      },
    }),
    [categories, tags],
  );

  const getVizEntriesToDisplay = () => {
    if (isActivelySearching) {
      return searchResults;
    }
    if (
      activeSelector === ALL_CHARTS &&
      activeSection === SECTIONS.ALL_CHARTS
    ) {
      return sortedMetadata;
    }
    if (
      activeSection === SECTIONS.CATEGORY &&
      chartsByCategory[activeSelector]
    ) {
      return chartsByCategory[activeSelector];
    }
    if (
      (activeSection === SECTIONS.TAGS ||
        activeSection === SECTIONS.RECOMMENDED_TAGS) &&
      chartsByTags[activeSelector]
    ) {
      return chartsByTags[activeSelector];
    }
    return [];
  };

  return (
    <VizPickerLayout
      className={className}
      isSelectedVizMetadata={Boolean(selectedVizMetadata)}
    >
      <LeftPane>
        <Selector
          css={({ gridUnit }) =>
            // adjust style for not being inside a collapse
            css`
              margin: ${gridUnit * 2}px;
              margin-bottom: 0;
            `
          }
          sectionId={SECTIONS.ALL_CHARTS}
          selector={ALL_CHARTS}
          icon={<Icons.Ballot />}
          isSelected={
            !isActivelySearching &&
            ALL_CHARTS === activeSelector &&
            SECTIONS.ALL_CHARTS === activeSection
          }
          onClick={clickSelector}
        />
        <AntdCollapse
          expandIconPosition="right"
          ghost
          defaultActiveKey={Object.keys(sectionMap)}
        >
          {Object.keys(sectionMap).map(sectionId => {
            const section = sectionMap[sectionId];

            return (
              <AntdCollapse.Panel
                header={<span className="header">{section.title}</span>}
                key={sectionId}
              >
                {section.selectors.map((selector: string) => (
                  <Selector
                    key={selector}
                    selector={selector}
                    sectionId={sectionId}
                    icon={section.icon}
                    isSelected={
                      !isActivelySearching &&
                      selector === activeSelector &&
                      sectionId === activeSection
                    }
                    onClick={clickSelector}
                  />
                ))}
              </AntdCollapse.Panel>
            );
          })}
        </AntdCollapse>
      </LeftPane>

      <SearchWrapper>
        <Input
          type="text"
          ref={searchInputRef as any /* cast required because emotion */}
          value={searchInputValue}
          placeholder={t('Search all charts')}
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

      <RightPane>
        <ThumbnailGallery
          vizEntries={getVizEntriesToDisplay()}
          selectedViz={selectedViz}
          setSelectedViz={onChange}
          onDoubleClick={onDoubleClick}
        />
      </RightPane>

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
                position: relative;
              `}
            >
              {selectedVizMetadata?.name}
              {selectedVizMetadata?.label && (
                <Tooltip
                  id="viz-badge-tooltip"
                  placement="top"
                  title={
                    selectedVizMetadata.labelExplanation ??
                    chartLabelExplanations[selectedVizMetadata.label]
                  }
                >
                  <TitleLabelWrapper>
                    <HighlightLabel>
                      <div>{t(selectedVizMetadata.label)}</div>
                    </HighlightLabel>
                  </TitleLabelWrapper>
                </Tooltip>
              )}
            </SectionTitle>
            <TagsWrapper>
              {selectedVizMetadata?.tags.map(tag => (
                <Label key={tag}>{tag}</Label>
              ))}
            </TagsWrapper>
            <Description>
              {selectedVizMetadata?.description ||
                t('No description available.')}
            </Description>
            <SectionTitle
              css={css`
                grid-area: examples-header;
              `}
            >
              {t('Examples')}
            </SectionTitle>
            <Examples>
              {(selectedVizMetadata?.exampleGallery?.length
                ? selectedVizMetadata.exampleGallery
                : [
                    {
                      url: selectedVizMetadata?.thumbnail,
                      caption: selectedVizMetadata?.name,
                    },
                  ]
              ).map(example => (
                <img
                  key={example.url}
                  src={example.url}
                  alt={example.caption}
                  title={example.caption}
                />
              ))}
            </Examples>
          </>
        </div>
      ) : null}
    </VizPickerLayout>
  );
}
