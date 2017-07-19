import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Label, ListGroup, ListGroupItem, FormControl } from 'react-bootstrap';
import { toggleMetric } from '../actions/querySettingsActions';
import { toggleSeparateCharts } from '../actions/vizSettingsActions';

const propTypes = {
  metrics: PropTypes.arrayOf(PropTypes.object).isRequired,
  selected: PropTypes.object.isRequired,
  separateCharts: PropTypes.bool,
  handleChange: PropTypes.func.isRequired,
  handleSeparateCharts: PropTypes.func,
  splittable: PropTypes.bool,
  metricSearchTrigger: PropTypes.bool,
};

class MetricContainer extends PureComponent {
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
    const { metrics, separateCharts, handleSeparateCharts, selected } = nextProps;
    if (separateCharts && metrics.filter(x => !!selected[x.id]).length < 2) {
      handleSeparateCharts();
    }
    if (nextProps.metricSearchTrigger !== this.props.metricSearchTrigger) {
      this.setState({ showFilter: !this.state.showFilter });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if ((!prevState.showFilter && this.state.showFilter)
    || (this.showFilter && prevState.filter !== this.state.filter)) {
      this.filterRef.focus();
    }
  }

  handleFilter(e) {
    this.setState({ filter: e.target.value });
    this.filterRef.focus();
  }

  handleClear(e) {
    if (e.keyCode === 27) {
      this.setState({ filter: '' });
    }
  }

  render() {
    const { metrics, handleChange, separateCharts,
      handleSeparateCharts, selected, splittable } = this.props;
    const { filter, showFilter } = this.state;
    return (
      <div className="metric-container">
        <div className="pull-right">
          { (metrics.filter(x => selected[x.id]).length > 1) && splittable &&
            <a
              onClick={handleSeparateCharts}
              title="Split Chart"
              data-toggle="tooltip"
            >
              <i className={`fa ${separateCharts ? 'fa-minus' : 'fa-bars'}`} />
            </a>
          }
          &nbsp;
          <a
            onClick={() => { this.setState({ showFilter: !showFilter, filter: '' }); }}
            title="Search"
            data-toggle="tooltip"
          >
            <i className="fa fa-search" />
          </a>
        </div>
        <div className="clearfix" />
        <Label>Metrics</Label>
        <ListGroup className="sidebar-container">
          {
              showFilter && <ListGroupItem>
                <FormControl
                  inputRef={(ref) => { this.filterRef = ref; }}
                  type="text"
                  value={filter}
                  placeholder="Search metrics"
                  onChange={this.handleFilter}
                  onKeyDown={this.handleClear}
                />
              </ListGroupItem>
            }
          { metrics.filter(x => selected[x.id] ||
                !filter ||
                x.name.toLowerCase().includes(filter.toLowerCase()))
                .sort((a, b) => {
                  if (a && b) {
                    if (!!selected[a.id] === !!selected[b.id]) {
                      return a.name.localeCompare(b.name);
                    }
                    if (selected[a.id]) {
                      return -1;
                    }
                    return 1;
                  }
                  return 0;
                })
                .map((m, index) => (
                  <ListGroupItem
                    key={index}
                    active={!!selected[m.id]}
                    onClick={() => handleChange({ id: m.id })}
                  >
                    {m.name}
                  </ListGroupItem>
                ))}
        </ListGroup>
      </div>
    );
  }
}

MetricContainer.propTypes = propTypes;
const mapStateToProps = state => ({
  metrics: state.refData.metrics,
  selected: state.settings.present.query.metrics,
  separateCharts: state.settings.present.viz.separateCharts,
  splittable: state.settings.present.query.vizType !== 'table',
  metricSearchTrigger: state.keyBindings.metricSearchTrigger,
});

const mapDispatchToProps = dispatch => ({
  handleChange: (metric) => { dispatch(toggleMetric(metric)); },
  handleSeparateCharts: () => { dispatch(toggleSeparateCharts()); },
});

export default connect(mapStateToProps, mapDispatchToProps)(MetricContainer);
