import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import React, { PureComponent } from 'react';
import { Label, ListGroup, ListGroupItem, FormControl } from 'react-bootstrap';
import Column from './Column';
import ColumnTypes from '../ColumnTypes';
import { addFilter, addSplit } from '../actions/querySettingsActions';

const propTypes = {
  columns: PropTypes.arrayOf(PropTypes.object),
  columnSearchTrigger: PropTypes.bool,

  handleAddFilter: PropTypes.func.isRequired,
  handleAddSplit: PropTypes.func.isRequired,
};

class ColumnContainer extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      filter: '',
      showFilter: false,
    };
    this.handleFilter = this.handleFilter.bind(this);
    this.handleClear = this.handleClear.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.columnSearchTrigger !== this.props.columnSearchTrigger) {
      this.setState({ showFilter: !this.state.showFilter });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if ((!prevState.showFilter && this.state.showFilter)
        || (this.showFilter && prevState.filter !== this.state.filter)) {
      this.filterRef.focus();
    }
  }

  handleClear(e) {
    if (e.keyCode === 27) {
      this.setState({ filter: '' });
    }
  }

  handleFilter(e) {
    this.setState({ filter: e.target.value });
    this.filterRef.focus();
  }

  render() {
    const { columns, handleAddFilter, handleAddSplit } = this.props;
    const { filter, showFilter } = this.state;
    return (
      <div className="column-container">
        <div className="pull-right">
          <a
            onClick={() => { this.setState({ showFilter: !showFilter, filter: '' }); }}
            title="Search"
            data-toggle="tooltip"
          >
            <i className="fa fa-search" />
          </a>
        </div>
        <div className="clearfix" />
        <Label>Columns</Label>
        <ListGroup className="sidebar-container">
          {
            showFilter && <ListGroupItem>
              <FormControl
                inputRef={(ref) => { this.filterRef = ref; }}
                type="text"
                value={filter}
                placeholder="Search columns"
                onChange={this.handleFilter}
                onKeyDown={this.handleClear}
              />
            </ListGroupItem>
          }
          {columns.sort((a, b) => {
            if (a.columnType === ColumnTypes.TIMESTAMP &&
                  b.columnType !== ColumnTypes.TIMESTAMP) {
              return -1;
            } else if (a.columnType !== ColumnTypes.TIMESTAMP &&
                       b.columnType === ColumnTypes.TIMESTAMP) {
              return 1;
            }
            return a.name.localeCompare(b.name);
          })
          .filter(x => !filter ||
              x.name.toLowerCase().includes(filter.toLowerCase()))
          .map(({ name, id, columnType, groupable }, index) =>
            (<ListGroupItem key={index}>
              <Column
                name={name}
                id={id}
                columnType={columnType}
                groupable={groupable}
                handleAddFilter={handleAddFilter}
                handleAddSplit={handleAddSplit}
              />
            </ListGroupItem>),
          )}
        </ListGroup>
      </div>
    );
  }
}

ColumnContainer.propTypes = propTypes;
const mapDispatchToProps = dispatch => ({
  handleAddFilter: (filter) => {
    dispatch(addFilter(filter));
  },
  handleAddSplit: (split) => {
    dispatch(addSplit(split));
  },
});

const mapStateToProps = state => ({
  columns: state.refData.columns,
  columnSearchTrigger: state.keyBindings.columnSearchTrigger,
});

export default connect(mapStateToProps, mapDispatchToProps)(ColumnContainer);
