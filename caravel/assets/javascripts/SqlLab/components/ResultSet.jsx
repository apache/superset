import React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { Table } from 'reactable';


class ResultSet extends React.Component {
  shouldComponentUpdate() {
    return false;
  }
  render() {
    const results = this.props.query.results;
    let controls = <div className="noControls" />;
    if (this.props.showControls) {
      controls = (
        <div className="ResultSetControls">
          <div className="clearfix">
            <div className="pull-left">
              <Button className="m-r-5"><i className="fa fa-line-chart" />Visualize</Button>
              <Button className="m-r-5"><i className="fa fa-file-text-o" />.CSV</Button>
            </div>
            <div className="pull-right">
              <input type="text" className="form-control" placeholder="Search Results" />
            </div>
          </div>
        </div>
      );
    }
    if (results.data.length > 0) {
      return (
        <div className="ResultSet">
          {controls}
          <Table
            data={results.data}
            columns={results.columns}
            sortable
            className="table table-condensed table-bordered"
          />
        </div>
      );
    }
    return (<Alert bsStyle="warning">The query returned no data</Alert>);
  }
}
ResultSet.propTypes = {
  query: React.PropTypes.object,
  showControls: React.PropTypes.boolean,
  search: React.PropTypes.boolean,
};
ResultSet.defaultProps = {
  showControls: true,
  search: true,
};

export default ResultSet;
