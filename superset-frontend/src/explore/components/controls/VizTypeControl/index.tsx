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
import Tabs from 'src/components/Tabs';
import { Tooltip } from 'src/components/Tooltip';
import Label, { Type } from 'src/components/Label';
import Icons from 'src/components/Icons';
import ControlHeader from 'src/explore/components/ControlHeader';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import './VizTypeControl.less';

const propTypes = {
  description: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string.isRequired,
  labelType: PropTypes.string,
};

interface VizTypeControlProps {
  description?: string;
  label?: string;
  name: string;
  onChange: (vizType: string) => void;
  value: string;
  labelType?: Type;
  isModalOpenInit?: boolean;
}

type VizEntry = {
  key: string;
  value: ChartMetadata;
};

const defaultProps = {
  onChange: () => {},
  labelType: 'default',
};

const metadataRegistry = getChartMetadataRegistry();

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

export const VIZ_TYPE_CONTROL_TEST_ID = 'viz-type-control';

function VizSupportValidation({ vizType }: { vizType: string }) {
  const state = usePluginContext();
  if (state.loading || metadataRegistry.has(vizType)) {
    return null;
  }
  return (
    <div className="text-danger">
      <i className="fa fa-exclamation-circle text-danger" />{' '}
      <small>{t('This visualization type is not supported.')}</small>
    </div>
  );
}

const UnpaddedModal = styled(Modal)`
  .ant-modal-body {
    padding: 0;
  }
`;

const VizPickerLayout = styled.div`
  display: grid;
  grid-template-rows: auto 1fr 30%;
  height: 70vh;
`;

const SectionTitle = styled.h3`
  margin-top: 0;
  font-size: ${({ theme }) => theme.gridUnit * 4}px;
  font-weight: 500;
  line-height: ${({ theme }) => theme.gridUnit * 6}px;
`;

const IconPane = styled.div`
  overflow: auto;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`;

const CategoriesTabs = styled(Tabs)`
  overflow: auto;

  .ant-tabs-nav {
    width: 20%;
  }

  .ant-tabs-content-holder {
    overflow: auto;
  }

  & > .ant-tabs-nav .ant-tabs-ink-bar {
    visibility: hidden;
  }

  .ant-tabs-tab-btn {
    text-transform: capitalize;
  }

  ${({ theme }) => `
   &.ant-tabs-left > .ant-tabs-nav .ant-tabs-tab {
      margin: ${theme.gridUnit * 2}px;
      margin-bottom: 0;
      padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;

      .ant-tabs-tab-btn {
        display: block;
        text-align: left;
      }

      &:hover,
      &-active {
        color: ${theme.colors.grayscale.dark1};
        border-radius: ${theme.borderRadius}px;
        background-color: ${theme.colors.secondary.light4};

        .ant-tabs-tab-remove > svg {
          color: ${theme.colors.grayscale.base};
          transition: all 0.3s;
        }
      }
    }

    &.ant-tabs-left > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane {
      padding: ${theme.gridUnit * 2}px;
    }
  `}
`;

const DetailsPane = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
`;

const Description = styled.p`
  overflow: auto;
`;

const SearchPane = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const SearchResultsPane = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const thumbnailContainerCss = (theme: SupersetTheme) => css`
  cursor: pointer;
  width: ${theme.gridUnit * 24}px;
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
  ...others
}) => (
  <IconPane data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viz-row`}>
    {vizEntries.map(entry => (
      <Thumbnail {...others} entry={entry} />
    ))}
  </IconPane>
);

/** Manages the viz type and the viz picker modal */
const VizTypeControl = (props: VizTypeControlProps) => {
  const { value: initialValue, onChange, isModalOpenInit, labelType } = props;
  const theme = useTheme();
  const { mountedPluginMetadata } = usePluginContext();
  const [showModal, setShowModal] = useState(!!isModalOpenInit);
  const [activeCategory, setActiveCategory] = useState<string | undefined>(
    undefined,
  );
  const [categoryRecall, setCategoryRecall] = useState<string | undefined>(
    undefined,
  );
  const [searchInputValue, setSearchInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedViz, setSelectedViz] = useState(initialValue);

  const onSubmit = useCallback(() => {
    onChange(selectedViz);
    setShowModal(false);
  }, [selectedViz, onChange]);

  const toggleModal = useCallback(() => {
    setShowModal(prevState => !prevState);

    // make sure the modal opens up to the last submitted viz
    setSelectedViz(initialValue);
    setActiveCategory(
      mountedPluginMetadata[initialValue]?.category || undefined,
    );
  }, [initialValue, mountedPluginMetadata]);

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
    if (activeCategory !== undefined) {
      // this will allow us to go back to the tab the user
      // was looking at when they exit their search.
      // "undefined" check is needed because undefined is used when searching,
      // and we don't want to go back to that when we stop searching.
      setCategoryRecall(activeCategory);
    }
    setActiveCategory(undefined);
    setIsSearching(true);
  }, [activeCategory]);

  const stopSearching = useCallback(() => {
    setActiveCategory(categoryRecall);
    setIsSearching(false);
  }, [categoryRecall]);

  const onTabClick = useCallback((key: string) => {
    setActiveCategory(key);
    setIsSearching(false);
  }, []);

  const labelContent =
    mountedPluginMetadata[initialValue]?.name || `${initialValue}`;

  const selectedVizMetadata = mountedPluginMetadata[selectedViz];

  return (
    <div>
      <ControlHeader {...props} />
      <Tooltip
        id="error-tooltip"
        placement="right"
        title={t('Click to change visualization type')}
      >
        <>
          <Label
            onClick={toggleModal}
            type={labelType}
            data-test="visualization-type"
          >
            {labelContent}
          </Label>
          <VizSupportValidation vizType={initialValue} />
        </>
      </Tooltip>

      <UnpaddedModal
        show={showModal}
        onHide={toggleModal}
        title={t('Select a visualization type')}
        primaryButtonName={t('Select')}
        onHandledPrimaryAction={onSubmit}
        responsive
      >
        <VizPickerLayout>
          <SearchPane>
            <Input
              type="text"
              value={searchInputValue}
              placeholder={t('Search')}
              onChange={changeSearch}
              onFocus={startSearching}
              data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__search-input`}
              suffix={
                <div
                  css={css`
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: ${theme.colors.grayscale.base};
                  `}
                >
                  <Icons.XLarge iconSize="m" onClick={stopSearching} />
                </div>
              }
            />
          </SearchPane>

          {isSearching ? (
            <SearchResultsPane>
              {/* <h3 css={searchResultsHeaderCss}>Search Results</h3> */}
              <ThumbnailGallery
                vizEntries={searchResults}
                selectedViz={selectedViz}
                setSelectedViz={setSelectedViz}
              />
            </SearchResultsPane>
          ) : (
            <CategoriesTabs
              tabPosition="left"
              activeKey={activeCategory}
              onTabClick={onTabClick}
            >
              {Object.entries(chartsByCategory).map(([category, vizTypes]) => (
                <Tabs.TabPane tab={category} key={category}>
                  <ThumbnailGallery
                    vizEntries={vizTypes}
                    selectedViz={selectedViz}
                    setSelectedViz={setSelectedViz}
                  />
                </Tabs.TabPane>
              ))}
            </CategoriesTabs>
          )}

          <DetailsPane>
            <SectionTitle>{selectedVizMetadata?.name}</SectionTitle>
            <Description>
              {selectedVizMetadata?.description ||
                t('No description available.')}
            </Description>
          </DetailsPane>
        </VizPickerLayout>
      </UnpaddedModal>
    </div>
  );
};

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;

export default VizTypeControl;
