import React from 'react';
import moment from 'moment';
import TableLoader from './TableLoader';

const propTypes = {
  user: React.PropTypes.object.isRequired,
};

export default class Favorites extends React.PureComponent {
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
      creator: <a href={slice.creator_url}>{slice.creator}</a>,
      favorited: moment.utc(slice.dttm).fromNow(),
      _favorited: slice.dttm,
    }));
    return (
      <TableLoader
        dataEndpoint={`/superset/fave_slices/${this.props.user.userId}/`}
        className="table table-condensed"
        columns={['slice', 'creator', 'favorited']}
        mutator={mutator}
        noDataText="No favorite slices yet, go click on stars!"
        sortable
      />
    );
  }
  renderDashboardTable() {
    const mutator = (data) => data.map(dash => ({
      dashboard: <a href={dash.url}>{dash.title}</a>,
      creator: <a href={dash.creator_url}>{dash.creator}</a>,
      favorited: moment.utc(dash.dttm).fromNow(),
    }));
    return (
      <TableLoader
        className="table table-condensed"
        mutator={mutator}
        dataEndpoint={`/superset/fave_dashboards/${this.props.user.userId}/`}
        noDataText="No favorite dashboards yet, go click on stars!"
        columns={['dashboard', 'creator', 'favorited']}
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
Favorites.propTypes = propTypes;
