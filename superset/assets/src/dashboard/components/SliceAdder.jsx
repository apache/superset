/* eslint-env browser */
import React from 'react';
import PropTypes from 'prop-types';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import { List } from 'react-virtualized';
import SearchInput, { createFilter } from 'react-search-input';

import AddSliceCard from './AddSliceCard';
import AddSliceDragPreview from './dnd/AddSliceDragPreview';
import DragDroppable from './dnd/DragDroppable';
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
  selectedSliceIds: PropTypes.object,
  editMode: PropTypes.bool,
  height: PropTypes.number,
};

const defaultProps = {
  selectedSliceIds: new Set(),
  editMode: false,
  errorMessage: '',
  height: window.innerHeight,
};

const KEYS_TO_FILTERS = ['slice_name', 'viz_type', 'datasource_name'];
const KEYS_TO_SORT = [
  { key: 'slice_name', label: 'Name' },
  { key: 'viz_type', label: 'Visualization' },
  { key: 'datasource_name', label: 'Datasource' },
  { key: 'changed_on', label: 'Recent' },
];

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
    };

    this.rowRenderer = this.rowRenderer.bind(this);
    this.searchUpdated = this.searchUpdated.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
  }

  componentDidMount() {
    this.slicesRequest = this.props.fetchAllSlices(this.props.userId);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.lastUpdated !== this.props.lastUpdated) {
      this.setState({
        filteredSlices: Object.values(nextProps.slices)
          .filter(createFilter(this.state.searchTerm, KEYS_TO_FILTERS))
          .sort(
            SliceAdder.sortByComparator(KEYS_TO_SORT[this.state.sortBy].key),
          ),
      });
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
    const cellData = this.state.filteredSlices[index];
    const isSelected = this.props.selectedSliceIds.has(cellData.slice_id);
    const type = CHART_TYPE;
    const id = NEW_CHART_ID;
    const meta = {
      chartId: cellData.slice_id,
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
      >
        {({ dragSourceRef }) => (
          <AddSliceCard
            innerRef={dragSourceRef}
            style={style}
            sliceName={cellData.slice_name}
            lastModified={
              cellData.modified ? cellData.modified.replace(/<[^>]*>/g, '') : ''
            }
            visType={cellData.viz_type}
            datasourceLink={cellData.datasource_link}
            isSelected={isSelected}
          />
        )}
      </DragDroppable>
    );
  }

  render() {
    return (
      <div className="slice-adder-container">
        <div className="controls">
          <DropdownButton
            title={KEYS_TO_SORT[this.state.sortBy].label}
            onSelect={this.handleSelect}
            id="slice-adder-sortby"
          >
            {KEYS_TO_SORT.map((item, index) => (
              <MenuItem key={item.key} eventKey={index}>
                {item.label}
              </MenuItem>
            ))}
          </DropdownButton>

          <SearchInput
            onChange={this.searchUpdated}
            onKeyPress={this.handleKeyPress}
          />
        </div>

        {this.props.isLoading && (
          <img
            src="/static/assets/images/loading.gif"
            className="loading"
            alt="loading"
          />
        )}

        {this.props.errorMessage && <div>{this.props.errorMessage}</div>}

        {!this.props.isLoading &&
          this.state.filteredSlices.length > 0 && (
            <List
              width={376}
              height={this.props.height}
              rowCount={this.state.filteredSlices.length}
              rowHeight={136}
              rowRenderer={this.rowRenderer}
              searchTerm={this.state.searchTerm}
              sortBy={this.state.sortBy}
              selectedSliceIds={this.props.selectedSliceIds}
            />
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
