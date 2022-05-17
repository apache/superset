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
import { List } from 'react-virtualized';
import { createFilter } from 'react-search-input';
import { t, styled, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { Input } from 'src/components/Input';
import { Select } from 'src/components';
import Loading from 'src/components/Loading';
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
  height: PropTypes.number,
  filterboxMigrationState: FILTER_BOX_MIGRATION_STATES,
};

const defaultProps = {
  selectedSliceIds: [],
  editMode: false,
  errorMessage: '',
  height: window.innerHeight,
  filterboxMigrationState: FILTER_BOX_MIGRATION_STATES.NOOP,
};

const KEYS_TO_FILTERS = ['slice_name', 'viz_type', 'datasource_name'];
const KEYS_TO_SORT = {
  slice_name: 'name',
  viz_type: 'viz type',
  datasource_name: 'dataset',
  changed_on: 'recent',
};

const DEFAULT_SORT_KEY = 'changed_on';

const MARGIN_BOTTOM = 16;
const SIDEPANE_HEADER_HEIGHT = 30;
const SLICE_ADDER_CONTROL_HEIGHT = 64;
const DEFAULT_CELL_HEIGHT = 112;

const Controls = styled.div`
  display: flex;
  flex-direction: row;
  padding: ${({ theme }) => theme.gridUnit * 3}px;
`;

const StyledSelect = styled(Select)`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  min-width: 150px;
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
    this.handleChange = this.handleChange.bind(this);
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

  handleChange(ev) {
    this.searchUpdated(ev.target.value);
  }

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
            isSelected={isSelected}
          />
        )}
      </DragDroppable>
    );
  }

  render() {
    const slicesListHeight =
      this.props.height -
      SIDEPANE_HEADER_HEIGHT -
      SLICE_ADDER_CONTROL_HEIGHT -
      MARGIN_BOTTOM;
    return (
      <div className="slice-adder-container">
        <Controls>
          <Input
            placeholder={t('Filter your charts')}
            className="search-input"
            onChange={this.handleChange}
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
          <List
            width={376}
            height={slicesListHeight}
            rowCount={this.state.filteredSlices.length}
            rowHeight={DEFAULT_CELL_HEIGHT}
            rowRenderer={this.rowRenderer}
            searchTerm={this.state.searchTerm}
            sortBy={this.state.sortBy}
            selectedSliceIds={this.props.selectedSliceIds}
          />
        )}
        {this.props.errorMessage && (
          <div className="error-message">{this.props.errorMessage}</div>
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
