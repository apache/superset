import React from 'react';
import TableLoader from './TableLoader';
import moment from 'moment';
import $ from 'jquery';

const propTypes = {
  user: React.PropTypes.object,
};

export default class RecentActivity extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      recentActions: [],
    };
  }

  componentWillMount() {
    $.get(`/superset/recent_activity/${this.props.user.userId}/`, (data) => {
      this.setState({ recentActions: data });
    });
  }
  render() {
    const mutator = function (data) {
      return data.map(row => ({
        action: row.action,
        item: <a href={row.item_url}>{row.item_title}</a>,
        time: moment.utc(row.time).fromNow(),
        _time: row.time,
      }));
    };
    return (
      <div>
        <TableLoader
          className="table table-condensed"
          mutator={mutator}
          sortable
          dataEndpoint={`/superset/recent_activity/${this.props.user.userId}/`}
        />
      </div>
    );
  }
}
RecentActivity.propTypes = propTypes;
