import React from 'react';
import { Table, Tr, Td } from 'reactable';
import moment from 'moment';
import $ from 'jquery';

class RecentActivity extends React.PureComponent {
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
    const data = this.state.recentActions.map(row => (
      <Tr>
        <Td column="action">{row.action}</Td>
        <Td column="item">
          <a href={row.item_url}>{row.item_title}</a>
        </Td>
        <Td column="time" value={row.time}>{moment.utc(row.time).fromNow()}</Td>
      </Tr>)
    );
    return (
      <div>
        <Table
          className="table table-condensed"
          sortable
        >
          {data}
        </Table>
      </div>
    );
  }
}

export default RecentActivity;
