import React from 'react';
import moment from 'moment';
import TableLoader from './TableLoader';

const propTypes = {
  user: React.PropTypes.object.isRequired,
};

class CreatedContent extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dashboardsLoading: true,
      slicesLoading: true,
      dashboards: [],
      slices: [],
    };
  }
  renderSliceTable() {
    const mutator = (data) => data.map(slice => ({
      slice: <a href={slice.url}>{slice.title}</a>,
      favorited: moment.utc(slice.dttm).fromNow(),
      _favorited: slice.dttm,
    }));
    return (
      <TableLoader
        dataEndpoint={`/superset/created_slices/${this.props.user.userId}/`}
        className="table table-condensed"
        columns={['slice', 'favorited']}
        mutator={mutator}
        noDataText="No slices"
        sortable
      />
    );
  }
  renderDashboardTable() {
    const mutator = (data) => data.map(dash => ({
      dashboard: <a href={dash.url}>{dash.title}</a>,
      favorited: moment.utc(dash.dttm).fromNow(),
      _favorited: dash.dttm,
    }));
    return (
      <TableLoader
        className="table table-condensed"
        mutator={mutator}
        dataEndpoint={`/superset/created_dashboards/${this.props.user.userId}/`}
        noDataText="No dashboards"
        columns={['dashboard', 'favorited']}
        sortable
      />
    );
  }
  render() {
    return (
      <div>
        <h3>Dashboards</h3>
        {this.renderDashboardTable()}
        <hr />
        <h3>Slices</h3>
        {this.renderSliceTable()}
      </div>
    );
  }
}
CreatedContent.propTypes = propTypes;

export default CreatedContent;
