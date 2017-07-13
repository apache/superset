import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';

import TableLoader from './TableLoader';

const propTypes = {
  user: PropTypes.object,
};

export default class RecentActivity extends React.PureComponent {
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
