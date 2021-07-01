import React, {
  ChangeEventHandler,
  useCallback,
  useMemo,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import Fuse from 'fuse.js';
import {
  t,
  getChartMetadataRegistry,
  styled,
  css,
  ChartMetadata,
  SupersetTheme,
  useTheme,
} from '@superset-ui/core';
import { Input } from 'src/common/components';
import { usePluginContext } from 'src/components/DynamicPlugins';
import Modal from 'src/components/Modal';
import { Tooltip } from 'src/components/Tooltip';
import Label, { Type } from 'src/components/Label';
import Icons from 'src/components/Icons';
import ControlHeader from 'src/explore/components/ControlHeader';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import './VizTypeControl.less';

interface VizTypeGalleryProps {
  onChange: (vizType: string) => void;
  value: string;
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
  'pivot_table',
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

export const VIZ_TYPE_CONTROL_TEST_ID = 'viz-type-control';

const VizPickerLayout = styled.div`
  display: grid;
  grid-template-rows: 1fr 35%;
  grid-template-columns: 1fr 5fr;
  grid-template-areas:
    'sidebar main'
    'details details';
  height: 70vh;
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
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
`;

const DetailsPane = styled.div`
  grid-area: details;
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    'viz-name examples-header'
    'description examples';
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
  margin: ${theme.gridUnit * 2}px;

  img {
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
  selectedViz: string;
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
  selectedViz: string;
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
    className={isSelected ? 'selected' : ''}
    onClick={() => onClick(category)}
  >
    {category}
  </CategoryLabel>
);

export default function VizTypeGallery(props: VizTypeGalleryProps) {
  const { value: selectedViz, onChange } = props;
  const { mountedPluginMetadata } = usePluginContext();
  const [searchInputValue, setSearchInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const changeSearch: ChangeEventHandler<HTMLInputElement> = useCallback(
    event => {
      setSearchInputValue(event.target.value);
    },
    [],
  );

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
      const category = entry.value.category || 'Other';
      if (!result[category]) {
        result[category] = [];
      }
      result[category].push(entry);
    });
    return result;
  }, [chartMetadata]);

  // todo sort the categories
  const categories = useMemo(() => Object.keys(chartsByCategory), [
    chartsByCategory,
  ]);

  const [activeCategory, setActiveCategory] = useState<string>(
    () => categories[0],
  );

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

  const startSearching = useCallback(() => {
    setIsSearching(true);
  }, []);

  const stopSearching = useCallback(() => {
    setIsSearching(false);
    setSearchInputValue('');
  }, []);

  const onTabClick = useCallback(
    (key: string) => {
      setActiveCategory(key);
      stopSearching();
    },
    [stopSearching],
  );

  const selectedVizMetadata: ChartMetadata | undefined =
    mountedPluginMetadata[selectedViz];

  const vizEntriesToDisplay = isSearching
    ? searchResults
    : chartsByCategory[activeCategory] || [];

  return (
    <VizPickerLayout>
      <LeftPane>
        <SearchWrapper>
          <Input
            type="text"
            value={searchInputValue}
            placeholder={t('Search')}
            onChange={changeSearch}
            onFocus={startSearching}
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
        {categories.map(category => (
          <CategorySelector
            key={category}
            category={category}
            isSelected={!isSearching && category === activeCategory}
            onClick={onTabClick}
          />
        ))}
      </LeftPane>

      <ThumbnailGallery
        vizEntries={vizEntriesToDisplay}
        selectedViz={selectedViz}
        setSelectedViz={onChange}
      />

      <DetailsPane>
        <SectionTitle
          css={css`
            grid-area: viz-name;
          `}
        >
          {selectedVizMetadata?.name}
        </SectionTitle>
        <Description>
          {selectedVizMetadata?.description || t('No description available.')}
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
      </DetailsPane>
    </VizPickerLayout>
  );
}
