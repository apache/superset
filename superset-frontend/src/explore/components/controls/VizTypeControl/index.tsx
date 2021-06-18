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
  useRef,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { Input, Row, Col } from 'src/common/components';
import {
  t,
  getChartMetadataRegistry,
  styled,
  ChartMetadata,
} from '@superset-ui/core';
import { useDynamicPluginContext } from 'src/components/DynamicPlugins';
import Modal from 'src/components/Modal';
import Tabs from 'src/components/Tabs';
import { Tooltip } from 'src/components/Tooltip';
import Label, { Type } from 'src/components/Label';
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
  const state = useDynamicPluginContext();
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
  grid-template-rows: auto auto 30%;
  height: 70vh;
`;

const SectionTitle = styled.h3`
  margin-top: 0;
  font-size: ${({ theme }) => theme.gridUnit * 4}px;
  font-weight: 500;
  line-height: ${({ theme }) => theme.gridUnit * 6}px;
`;

const IconPane = styled(Row)`
  overflow: auto;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
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
  `}
`;

const DetailsPane = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const SearchPane = styled.div`
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const VizThumbnailContainer = styled.div`
  cursor: pointer;

  img {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;
    transition: border-color ${({ theme }) => theme.transitionTiming};
  }

  &.selected img {
    border: 2px solid ${({ theme }) => theme.colors.primary.light2};
  }

  &:hover:not(.selected) img {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

const VizTypeControl = (props: VizTypeControlProps) => {
  const { value: initialValue, onChange } = props;
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const searchRef = useRef<any>(null);
  const [selectedViz, setSelectedViz] = useState(initialValue);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => searchRef.current?.focus(), 200);
    }
  }, [showModal]);

  const onSubmit = useCallback(() => {
    onChange(selectedViz);
    setShowModal(false);
  }, [selectedViz, onChange]);

  const toggleModal = () => {
    setShowModal(prevState => !prevState);
  };

  const changeSearch: ChangeEventHandler<HTMLInputElement> = event => {
    setFilter(event.target.value);
  };

  const renderItem = (entry: VizEntry) => {
    const { key, value: type } = entry;
    const isSelected = key === selectedViz;

    return (
      <VizThumbnailContainer
        role="button"
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
      </VizThumbnailContainer>
    );
  };

  const { labelType } = props;
  const filterString = filter.toLowerCase();
  const filterStringParts = filterString.split(' ');

  const categories = DEFAULT_ORDER.filter(
    type =>
      metadataRegistry.has(type) &&
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      nativeFilterGate(metadataRegistry.get(type)!.behaviors || []),
  )
    .map(type => ({
      key: type,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      value: metadataRegistry.get(type),
    }))
    .concat(
      metadataRegistry
        .entries()
        .filter(entry => {
          const behaviors = entry.value?.behaviors || [];
          return nativeFilterGate(behaviors);
        })
        .filter(({ key }) => !typesWithDefaultOrder.has(key)),
    )
    .filter(
      entry =>
        !!entry.value &&
        filterStringParts.every(
          part => entry.value?.name.toLowerCase().indexOf(part) !== -1,
        ),
    )
    .reduce((acc, entry) => {
      const category = entry.value?.categories?.[0] || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      // typecast is safe because we filtered out falsy value already
      acc[category].push(entry as VizEntry);
      return acc;
    }, {} as Record<string, VizEntry[]>);

  const labelContent =
    metadataRegistry.get(initialValue)?.name || `${initialValue}`;

  const selectedVizMetadata = metadataRegistry.get(selectedViz);

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
        primaryButtonName={t('Create')}
        onHandledPrimaryAction={onSubmit}
        responsive
      >
        <VizPickerLayout>
          <SearchPane>
            <Input
              ref={searchRef}
              type="text"
              value={filter}
              placeholder={t('Search')}
              onChange={changeSearch}
              data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__search-input`}
            />
          </SearchPane>
          <CategoriesTabs tabPosition="left">
            {Object.entries(categories).map(([category, vizTypes]) => (
              <Tabs.TabPane tab={category} key={category}>
                <IconPane
                  data-test={`${VIZ_TYPE_CONTROL_TEST_ID}__viz-row`}
                  gutter={16}
                >
                  {vizTypes.map(entry => (
                    <Col xs={12} sm={8} md={6} lg={4} key={entry.key}>
                      {renderItem(entry)}
                    </Col>
                  ))}
                </IconPane>
              </Tabs.TabPane>
            ))}
          </CategoriesTabs>
          <DetailsPane>
            <SectionTitle>{selectedVizMetadata?.name}</SectionTitle>
            <p>
              {selectedVizMetadata?.description ||
                t('No description available.')}
            </p>
          </DetailsPane>
        </VizPickerLayout>
      </UnpaddedModal>
    </div>
  );
};

VizTypeControl.propTypes = propTypes;
VizTypeControl.defaultProps = defaultProps;

export default VizTypeControl;
