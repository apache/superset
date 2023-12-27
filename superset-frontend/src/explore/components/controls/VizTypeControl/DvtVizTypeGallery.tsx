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
import React, { useMemo, useState } from 'react';
import {
  t,
  styled,
  css,
  ChartMetadata,
  SupersetTheme,
  useTheme,
} from '@superset-ui/core';
import { usePluginContext } from 'src/components/DynamicPlugins';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';

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

const THUMBNAIL_GRID_UNITS = 100;

export const MAX_ADVISABLE_VIZ_GALLERY_WIDTH = 1090;

const OTHER_CATEGORY = t('Other');

const ALL_CHARTS = t('All charts');

export const VIZ_TYPE_CONTROL_TEST_ID = 'viz-type-control';

const VizPickerLayout = styled.div`
  display: grid;
  height: 100%;
`;

const RightPane = styled.div``;

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

// overflow hidden on the details pane and overflow auto on the description
// (plus grid layout) enables the description to scroll while the header stays in place.

const thumbnailContainerCss = (theme: SupersetTheme) => css`
  cursor: pointer;
  width: ${theme.gridUnit * THUMBNAIL_GRID_UNITS}px;
  position: relative;

  img {
    max-width: 547px;
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
      <div
        className="viztype-label"
        data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viztype-label`}
      >
        {type.name}
      </div>
      <img
        alt={type.name}
        width="100%"
        className={`viztype-selector ${isSelected ? 'selected' : ''}`}
        src={type.thumbnail}
      />
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

export default function VizTypeGallery(props: VizTypeGalleryProps) {
  const { selectedViz, onChange, onDoubleClick, className } = props;
  const { mountedPluginMetadata } = usePluginContext();

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

  const sortedMetadata = useMemo(
    () => chartMetadata.sort((a, b) => a.key.localeCompare(b.key)),
    [chartMetadata],
  );

  const [activeSelector, setActiveSelector] = useState<string>(
    () => selectedVizMetadata?.category || ALL_CHARTS,
  );

  const [activeSection, setActiveSection] = useState<string>(
    () => SECTIONS.ALL_CHARTS,
  );

  const getVizEntriesToDisplay = () => {
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
    <VizPickerLayout className={className}>
      <RightPane>
        <ThumbnailGallery
          vizEntries={getVizEntriesToDisplay()}
          selectedViz={selectedViz}
          setSelectedViz={onChange}
          onDoubleClick={onDoubleClick}
        />
      </RightPane>
    </VizPickerLayout>
  );
}
