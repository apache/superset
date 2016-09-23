import React from 'react';
import { Alert, Button, ButtonGroup } from 'react-bootstrap';
import { Table } from 'reactable';

import VisualizeModal from './VisualizeModal';


class ResultSet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      showModal: false,
    };
  }
  changeSearch(event) {
    this.setState({ searchText: event.target.value });
  }
  showModal() {
    this.setState({ showModal: true });
  }
  hideModal() {
    this.setState({ showModal: false });
  }
  render() {
    const results = this.props.query.results;
    let controls = <div className="noControls" />;
    if (this.props.showControls) {
      controls = (
        <div className="ResultSetControls">
          <div className="clearfix">
            <div className="pull-left">
              <ButtonGroup>
                <Button
                  bsSize="small"
                  onClick={this.showModal.bind(this)}
                >
                  <i className="fa fa-line-chart m-l-1" /> Visualize
                </Button>
                <Button bsSize="small" href={'/caravel/csv/' + this.props.query.id}>
                  <i className="fa fa-file-text-o" /> .CSV
                </Button>
              </ButtonGroup>
            </div>
            <div className="pull-right">
              <input
                type="text"
                onChange={this.changeSearch.bind(this)}
                className="form-control input-sm"
                placeholder="Search Results"
              />
            </div>
          </div>
        </div>
      );
    }
    if (results && results.data && results.data.length > 0) {
      return (
        <div>
          <VisualizeModal
            show={this.state.showModal}
            query={this.props.query}
            onHide={this.hideModal.bind(this)}
          />
          {controls}
          <div className="ResultSet">
            <Table
              data={results.data}
              columns={results.columns.map((col) => col.name)}
              sortable
              className="table table-condensed table-bordered"
              filterBy={this.state.searchText}
              filterable={results.columns}
              hideFilterInput
            />
          </div>
        </div>
      );
    }
    return (<Alert bsStyle="warning">The query returned no data</Alert>);
  }
}
ResultSet.propTypes = {
  query: React.PropTypes.object,
  showControls: React.PropTypes.bool,
  search: React.PropTypes.bool,
  searchText: React.PropTypes.string,
};
ResultSet.defaultProps = {
  showControls: true,
  search: true,
  searchText: '',
};

export default ResultSet;
