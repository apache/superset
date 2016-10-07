import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { VIZ_TYPES } from '../constants';

const propTypes = {
  actions: React.PropTypes.object,
  datasources: React.PropTypes.array,
  datasourceId: React.PropTypes.number,
  datasourceType: React.PropTypes.string,
  vizType: React.PropTypes.string,
};

const defaultProps = {
  datasources: [],
  datasourceId: null,
  datasourceType: null,
  vizType: null,
};

class ChartControl extends React.Component {
  componentWillMount() {
    if (this.props.datasourceId) {
      this.props.actions.setFormOpts(this.props.datasourceId, this.props.datasourceType);
    }
  }
  changeDatasource(datasourceOpt) {
    const val = (datasourceOpt) ? datasourceOpt.value : null;
    this.props.actions.setDatasource(val);
    this.props.actions.resetFormData();
    this.props.actions.setFormOpts(val, this.props.datasourceType);
  }
  changeViz(opt) {
    const val = opt ? opt.value : null;
    this.props.actions.setFormData('vizType', val);
  }
  render() {
    return (
      <div className="panel">
        <div className="panel-header">Chart Options</div>
        <div className="panel-body">
          <h5 className="section-heading">Datasource</h5>
          <div className="row">
            <Select
              name="select-datasource"
              placeholder="Select a datasource"
              options={this.props.datasources.map((d) => ({ value: d[0], label: d[1] }))}
              value={this.props.datasourceId}
              autosize={false}
              onChange={this.changeDatasource.bind(this)}
            />
          </div>
          <h5 className="section-heading">Viz Type</h5>
          <div className="row">
            <Select
              name="select-viztype"
              placeholder="Select a viz type"
              options={VIZ_TYPES}
              value={this.props.vizType}
              autosize={false}
              onChange={this.changeViz.bind(this)}
            />
          </div>
        </div>
      </div>
    );
  }
}

ChartControl.propTypes = propTypes;
ChartControl.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    datasources: state.datasources,
    datasourceId: state.datasourceId,
    datasourceType: state.datasourceType,
    vizType: state.viz.formData.vizType,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(ChartControl);
