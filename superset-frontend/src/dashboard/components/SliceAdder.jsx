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
import { DropdownButton, MenuItem } from 'react-bootstrap';
import { List } from 'react-virtualized';
import SearchInput, { createFilter } from 'react-search-input';
import { t } from '@superset-ui/translation';

import AddSliceCard from './AddSliceCard';
import AddSliceDragPreview from './dnd/AddSliceDragPreview';
import DragDroppable from './dnd/DragDroppable';
import Loading from '../../components/Loading';
import { CHART_TYPE, NEW_COMPONENT_SOURCE_TYPE } from '../util/componentTypes';
import { NEW_CHART_ID, NEW_COMPONENTS_SOURCE_ID } from '../util/constants';
import { slicePropShape } from '../util/propShapes';

const propTypes = {
  fetchAllSlices: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  slices: PropTypes.objectOf(slicePropShape).isRequired,
  lastUpdated: PropTypes.number.isRequired,
  errorMessage: PropTypes.string,
  userId: PropTypes.string.isRequired,
  selectedSliceIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  editMode: PropTypes.bool,
  height: PropTypes.number,
};

const defaultProps = {
  selectedSliceIds: [],
  editMode: false,
  errorMessage: '',
  height: window.innerHeight,
};

const KEYS_TO_FILTERS = ['slice_name', 'viz_type', 'datasource_name'];
const KEYS_TO_SORT = [
  { key: 'slice_name', label: 'Name' },
  { key: 'viz_type', label: 'Vis type' },
  { key: 'datasource_name', label: 'Datasource' },
  { key: 'changed_on', label: 'Recent' },
];

const MARGIN_BOTTOM = 16;
const SIDEPANE_HEADER_HEIGHT = 30;
const SLICE_ADDER_CONTROL_HEIGHT = 64;
const DEFAULT_CELL_HEIGHT = 112;

class SliceAdder extends React.Component {
  static sortByComparator(attr) {
    const desc = attr === 'changed_on' ? -1 : 1;

    return (a, b) => {
      if (a[attr] < b[attr]) {
        return -1 * desc;
      } else if (a[attr] > b[attr]) {
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
      sortBy: KEYS_TO_SORT.findIndex(item => item.key === 'changed_on'),
      selectedSliceIdsSet: new Set(props.selectedSliceIds),
    };
    this.rowRenderer = this.rowRenderer.bind(this);
    this.searchUpdated = this.searchUpdated.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
  }

  componentDidMount() {
    this.slicesRequest = this.props.fetchAllSlices(this.props.userId);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const nextState = {};
    if (nextProps.lastUpdated !== this.props.lastUpdated) {
      nextState.filteredSlices = Object.values(nextProps.slices)
        .filter(createFilter(this.state.searchTerm, KEYS_TO_FILTERS))
        .sort(SliceAdder.sortByComparator(KEYS_TO_SORT[this.state.sortBy].key));
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
      .sort(SliceAdder.sortByComparator(KEYS_TO_SORT[sortBy].key));
  }

  handleKeyPress(ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();

      this.searchUpdated(ev.target.value);
    }
  }

  searchUpdated(searchTerm) {
    this.setState({
      searchTerm,
      filteredSlices: this.getFilteredSortedSlices(
        searchTerm,
        this.state.sortBy,
      ),
    });
  }

  handleSelect(sortBy) {
    this.setState({
      sortBy,
      filteredSlices: this.getFilteredSortedSlices(
        this.state.searchTerm,
        sortBy,
      ),
    });
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
        <div className="controls">
          <SearchInput
            placeholder={t('Filter your charts')}
            className="search-input"
            onChange={this.searchUpdated}
            onKeyPress={this.handleKeyPress}
          />
          <DropdownButton
            title={`Sort by ${KEYS_TO_SORT[this.state.sortBy].label}`}
            onSelect={this.handleSelect}
            id="slice-adder-sortby"
          >
            {KEYS_TO_SORT.map((item, index) => (
              <MenuItem key={item.key} eventKey={index}>
                Sort by {item.label}
              </MenuItem>
            ))}
          </DropdownButton>
        </div>
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
