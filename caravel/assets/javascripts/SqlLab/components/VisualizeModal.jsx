import React from 'react';
import { Alert, Modal } from 'react-bootstrap';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';

import Select from 'react-select';
import { Table } from 'reactable';

class VisualizeModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      chartType: null,
    };
  }
  changeChartType(event) {
    this.setState({ chartType: event.target.value });
  }
  render() {
    if (!(this.props.query)) {
      return <div />;
    }
    const cols = this.props.query.results.columns;
    const modal = (
      <div className="VisualizeModal">
        <Modal show={this.props.show} onHide={this.props.onHide}>
          <Modal.Header closeButton>
            <Modal.Title>Visualize (mock)</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert bsStyle="danger">Not functional - Work in progress!</Alert>
            <div>
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
              <Table
                className="table table-condensed"
                columns={['column', 'is_dimension', 'is_date', 'agg_func']}
                data={cols.map((col) => ({
                  column: col,
                  is_dimension: <input type="checkbox" className="form-control" />,
                  is_date: <input type="checkbox" className="form-control" />,
                  agg_func: (
                    <Select
                      options={[
                        { value: 'sum', label: 'SUM(x)' },
                        { value: 'min', label: 'MIN(x)' },
                        { value: 'max', label: 'MAX(x)' },
                        { value: 'avg', label: 'AVG(x)' },
                        { value: 'count_distinct', label: 'COUNT(DISTINCT x)' },
                      ]}
                    />
                  ),
                }))}
              />
            </div>
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
