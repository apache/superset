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
/* eslint-env browser */
import React from 'react';
import PropTypes from 'prop-types';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';
import { createFilter } from 'react-search-input';
import {
  t,
  styled,
  isFeatureEnabled,
  FeatureFlag,
  css,
} from '@superset-ui/core';
import { Input } from 'src/components/Input';
import { Select } from 'src/components';
import Loading from 'src/components/Loading';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import {
  CHART_TYPE,
  NEW_COMPONENT_SOURCE_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  NEW_CHART_ID,
  NEW_COMPONENTS_SOURCE_ID,
} from 'src/dashboard/util/constants';
import { slicePropShape } from 'src/dashboard/util/propShapes';
import { FILTER_BOX_MIGRATION_STATES } from 'src/explore/constants';
import _ from 'lodash';
import AddSliceCard from './AddSliceCard';
import AddSliceDragPreview from './dnd/AddSliceDragPreview';
import DragDroppable from './dnd/DragDroppable';

const propTypes = {
  fetchAllSlices: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  lastUpdated: PropTypes.number.isRequired,
  errorMessage: PropTypes.string,
  userId: PropTypes.string.isRequired,
  selectedSliceIds: PropTypes.arrayOf(PropTypes.number),
  editMode: PropTypes.bool,
  filterboxMigrationState: FILTER_BOX_MIGRATION_STATES,
  dashboardId: PropTypes.number,
};

const defaultProps = {
  selectedSliceIds: [],
  editMode: false,
  errorMessage: '',
  filterboxMigrationState: FILTER_BOX_MIGRATION_STATES.NOOP,
};

const KEYS_TO_FILTERS = ['slice_name', 'viz_type', 'datasource_name'];
const KEYS_TO_SORT = {
  slice_name: t('name'),
  viz_type: t('viz type'),
  datasource_name: t('dataset'),
  changed_on: t('recent'),
};

const DEFAULT_SORT_KEY = 'changed_on';

const DEFAULT_CELL_HEIGHT = 128;

const Controls = styled.div`
  display: flex;
  flex-direction: row;
  padding: ${({ theme }) => theme.gridUnit * 3}px;
  padding-top: ${({ theme }) => theme.gridUnit * 4}px;
`;

const StyledSelect = styled(Select)`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  min-width: 150px;
`;

const NewChartButtonContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: flex-end;
    padding-right: ${theme.gridUnit * 2}px;
  `}
`;

const NewChartButton = styled(Button)`
  ${({ theme }) => css`
    height: auto;
    & > .anticon + span {
      margin-left: 0;
    }
    & > [role='img']:first-of-type {
      margin-right: ${theme.gridUnit}px;
      padding-bottom: 1px;
      line-height: 0;
    }
  `}
`;

export const ChartList = styled.div`
  flex-grow: 1;
  min-height: 0;
`;

class SliceAdder extends React.Component {
  static sortByComparator(attr) {
    const desc = attr === 'changed_on' ? -1 : 1;

    return (a, b) => {
      if (a[attr] < b[attr]) {
        return -1 * desc;
      }
      if (a[attr] > b[attr]) {
        return 1 * desc;
      }
      return 0;
    };
  }

  constructor(props) {
    super(props);
    this.state = {
      filteredSlices: [],
      searchTerm: '',
      sortBy: DEFAULT_SORT_KEY,
      selectedSliceIdsSet: new Set(props.selectedSliceIds),
    };
    this.rowRenderer = this.rowRenderer.bind(this);
    this.searchUpdated = this.searchUpdated.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
  }

  componentDidMount() {
    const { userId, filterboxMigrationState } = this.props;
    this.slicesRequest = this.props.fetchAllSlices(
      userId,
      isFeatureEnabled(FeatureFlag.ENABLE_FILTER_BOX_MIGRATION) &&
        filterboxMigrationState !== FILTER_BOX_MIGRATION_STATES.SNOOZED,
    );
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const nextState = {};
    if (nextProps.lastUpdated !== this.props.lastUpdated) {
      nextState.filteredSlices = Object.values(nextProps.slices)
        .filter(createFilter(this.state.searchTerm, KEYS_TO_FILTERS))
        .sort(SliceAdder.sortByComparator(this.state.sortBy));
    }

    if (nextProps.selectedSliceIds !== this.props.selectedSliceIds) {
      nextState.selectedSliceIdsSet = new Set(nextProps.selectedSliceIds);
    }

    if (Object.keys(nextState).length) {
      this.setState(nextState);
    }
  }

  componentWillUnmount() {
    if (this.slicesRequest && this.slicesRequest.abort) {
      this.slicesRequest.abort();
    }
  }

  getFilteredSortedSlices(searchTerm, sortBy) {
    return Object.values(this.props.slices)
      .filter(createFilter(searchTerm, KEYS_TO_FILTERS))
      .sort(SliceAdder.sortByComparator(sortBy));
  }

  handleKeyPress(ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();

      this.searchUpdated(ev.target.value);
    }
  }

  handleChange = _.debounce(value => {
    this.searchUpdated(value);

    const { userId, filterboxMigrationState } = this.props;
    this.slicesRequest = this.props.fetchFilteredSlices(
      userId,
      isFeatureEnabled(FeatureFlag.ENABLE_FILTER_BOX_MIGRATION) &&
        filterboxMigrationState !== FILTER_BOX_MIGRATION_STATES.SNOOZED,
      value,
    );
  }, 300);

  searchUpdated(searchTerm) {
    this.setState(prevState => ({
      searchTerm,
      filteredSlices: this.getFilteredSortedSlices(
        searchTerm,
        prevState.sortBy,
      ),
    }));
  }

  handleSelect(sortBy) {
    this.setState(prevState => ({
      sortBy,
      filteredSlices: this.getFilteredSortedSlices(
        prevState.searchTerm,
        sortBy,
      ),
    }));

    const { userId, filterboxMigrationState } = this.props;
    this.slicesRequest = this.props.fetchSortedSlices(
      userId,
      isFeatureEnabled(FeatureFlag.ENABLE_FILTER_BOX_MIGRATION) &&
        filterboxMigrationState !== FILTER_BOX_MIGRATION_STATES.SNOOZED,
      sortBy,
    );
  }

  rowRenderer({ key, index, style }) {
    const { filteredSlices, selectedSliceIdsSet } = this.state;
    const cellData = filteredSlices[index];
    const isSelected = selectedSliceIdsSet.has(cellData.slice_id);
    const type = CHART_TYPE;
    const id = NEW_CHART_ID;

    const meta = {
      chartId: cellData.slice_id,
      sliceName: cellData.slice_name,
    };
    return (
      <DragDroppable
        key={key}
        component={{ type, id, meta }}
        parentComponent={{
          id: NEW_COMPONENTS_SOURCE_ID,
          type: NEW_COMPONENT_SOURCE_TYPE,
        }}
        index={index}
        depth={0}
        disableDragDrop={isSelected}
        editMode={this.props.editMode}
        // we must use a custom drag preview within the List because
        // it does not seem to work within a fixed-position container
        useEmptyDragPreview
        // List library expect style props here
        // actual style should be applied to nested AddSliceCard component
        style={{}}
      >
        {({ dragSourceRef }) => (
          <AddSliceCard
            innerRef={dragSourceRef}
            style={style}
            sliceName={cellData.slice_name}
            lastModified={cellData.changed_on_humanized}
            visType={cellData.viz_type}
            datasourceUrl={cellData.datasource_url}
            datasourceName={cellData.datasource_name}
            thumbnailUrl={cellData.thumbnail_url}
            isSelected={isSelected}
          />
        )}
      </DragDroppable>
    );
  }

  render() {
    return (
      <div
        css={css`
          height: 100%;
          display: flex;
          flex-direction: column;
        `}
      >
        <NewChartButtonContainer>
          <NewChartButton
            buttonStyle="link"
            buttonSize="xsmall"
            onClick={() =>
              window.open(
                `/chart/add?dashboard_id=${this.props.dashboardId}`,
                '_blank',
                'noopener noreferrer',
              )
            }
          >
            <Icons.PlusSmall />
            {t('Create new chart')}
          </NewChartButton>
        </NewChartButtonContainer>
        <Controls>
          <Input
            placeholder={t('Filter your charts')}
            className="search-input"
            onChange={ev => this.handleChange(ev.target.value)}
            onKeyPress={this.handleKeyPress}
            data-test="dashboard-charts-filter-search-input"
          />
          <StyledSelect
            id="slice-adder-sortby"
            value={this.state.sortBy}
            onChange={this.handleSelect}
            options={Object.entries(KEYS_TO_SORT).map(([key, label]) => ({
              label: t('Sort by %s', label),
              value: key,
            }))}
            placeholder={t('Sort by')}
          />
        </Controls>
        {this.props.isLoading && <Loading />}
        {!this.props.isLoading && this.state.filteredSlices.length > 0 && (
          <ChartList>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  width={width}
                  height={height}
                  itemCount={this.state.filteredSlices.length}
                  itemSize={DEFAULT_CELL_HEIGHT}
                  searchTerm={this.state.searchTerm}
                  sortBy={this.state.sortBy}
                  selectedSliceIds={this.props.selectedSliceIds}
                >
                  {this.rowRenderer}
                </List>
              )}
            </AutoSizer>
          </ChartList>
        )}
        {this.props.errorMessage && (
          <div
            css={css`
              padding: 16px;
            `}
          >
            {this.props.errorMessage}
          </div>
        )}
        {/* Drag preview is just a single fixed-position element */}
        <AddSliceDragPreview slices={this.state.filteredSlices} />
      </div>
    );
  }
}

SliceAdder.propTypes = propTypes;
SliceAdder.defaultProps = defaultProps;

export default SliceAdder;
