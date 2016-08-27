import React from 'react';
import { Button, Col, Modal } from 'react-bootstrap';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';

import Select from 'react-select';
import { Table } from 'reactable';
import shortid from 'shortid';

class VisualizeModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      chartType: 'line',
      datasourceName: shortid.generate(),
      columns: {},
    };
  }
  changeChartType(option) {
    this.setState({ chartType: (option) ? option.value : null });
  }
  mergedColumns() {
    const columns = Object.assign({}, this.state.columns);
    if (this.props.query && this.props.query.results.columns) {
      this.props.query.results.columns.forEach((col) => {
        if (columns[col] === undefined) {
          columns[col] = {};
        }
      });
    }
    return columns;
  }
  visualize() {
    const vizOptions = {
      chartType: this.state.chartType,
      datasourceName: this.state.datasourceName,
      columns: this.state.columns,
      sql: this.props.query.sql,
      dbId: this.props.query.dbId,
    };
    window.open('/caravel/sqllab_viz/?data=' + JSON.stringify(vizOptions));
  }
  changeDatasourceName(event) {
    this.setState({ datasourceName: event.target.value });
  }
  changeCheckbox(attr, col, event) {
    let columns = this.mergedColumns();
    const column = Object.assign({}, columns[col], { [attr]: event.target.checked });
    columns = Object.assign({}, columns, { [col]: column });
    this.setState({ columns });
  }
  changeAggFunction(col, option) {
    let columns = this.mergedColumns();
    const val = (option) ? option.value : null;
    const column = Object.assign({}, columns[col], { agg: val });
    columns = Object.assign({}, columns, { [col]: column });
    this.setState({ columns });
  }
  render() {
    if (!(this.props.query)) {
      return <div />;
    }
    const tableData = this.props.query.results.columns.map((col) => ({
      column: col,
      is_dimension: (
        <input
          type="checkbox"
          onChange={this.changeCheckbox.bind(this, 'is_dim', col)}
          checked={(this.state.columns[col]) ? this.state.columns[col].is_dim : false}
          className="form-control"
        />
      ),
      is_date: (
        <input
          type="checkbox"
          className="form-control"
          onChange={this.changeCheckbox.bind(this, 'is_date', col)}
          checked={(this.state.columns[col]) ? this.state.columns[col].is_date : false}
        />
      ),
      agg_func: (
        <Select
          options={[
            { value: 'sum', label: 'SUM(x)' },
            { value: 'min', label: 'MIN(x)' },
            { value: 'max', label: 'MAX(x)' },
            { value: 'avg', label: 'AVG(x)' },
            { value: 'count_distinct', label: 'COUNT(DISTINCT x)' },
          ]}
          onChange={this.changeAggFunction.bind(this, col)}
          value={(this.state.columns[col]) ? this.state.columns[col].agg : null}
        />
      ),
    }));
    const modal = (
      <div className="VisualizeModal">
        <Modal show={this.props.show} onHide={this.props.onHide}>
          <Modal.Header closeButton>
            <Modal.Title>
              Visualize <span className="alert alert-danger">under construction</span>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="row">
              <Col md={6}>
                Chart Type
                <Select
                  name="select-chart-type"
                  placeholder="[Chart Type]"
                  options={[
                    { value: 'line', label: 'Time Series - Line Chart' },
                    { value: 'bar', label: 'Time Series - Bar Chart' },
                    { value: 'bar_dist', label: 'Distribution - Bar Chart' },
                    { value: 'pie', label: 'Pie Chart' },
                  ]}
                  value={this.state.chartType}
                  autosize={false}
                  onChange={this.changeChartType.bind(this)}
                />
              </Col>
              <Col md={6}>
                Datasource Name
                <input
                  type="text"
                  className="form-control"
                  placeholder="datasource name"
                  onChange={this.changeDatasourceName.bind(this)}
                  value={this.state.datasourceName}
                />
              </Col>
            </div>
            <hr />
            <Table
              className="table table-condensed"
              columns={['column', 'is_dimension', 'is_date', 'agg_func']}
              data={tableData}
            />
            <Button
              onClick={this.visualize.bind(this)}
              bsStyle="primary"
            >
              Visualize
            </Button>
          </Modal.Body>
        </Modal>
      </div>
    );
    return modal;
  }
}
VisualizeModal.propTypes = {
  query: React.PropTypes.object,
  show: React.PropTypes.boolean,
  onHide: React.PropTypes.function,
};
VisualizeModal.defaultProps = {
  show: false,
};

function mapStateToProps() {
  return {};
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(VisualizeModal);
