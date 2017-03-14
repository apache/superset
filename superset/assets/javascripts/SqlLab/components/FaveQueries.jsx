const $ = window.$ = require('jquery');
import QueryTable from './QueryTable';
import React from 'react';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
};

class FaveQueries extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      favedQueries: [],
      fetching: false,
    };
  }

  deleteQuery(query) {
    this.props.actions.favouriteQuery(query, false);
    this.fetchFaveQueries();
  }
  fetchFaveQueries() {
    this.setState({ fetching: true });
    $.ajax({
      type: 'GET',
      url: '/superset/fave_queries/',
      success: (data) => {
        this.setState({ favedQueries: data });
        this.setState({ fetching: false });
      },
    });
  }
  componentDidMount() {
    this.fetchFaveQueries();
  }
  render() {
    if (this.state.fetching) {
      return (
        <img
          className="loading"
          alt="Loading..."
          src="/static/assets/images/loading.gif"
        />
      );
    }
    return (
      <div
        style={{ height: this.props.height }}
        className="scrollbar-container"
      >
        <div className="scrollbar-content">
          <QueryTable
            columns={[
              'db', 'schema', 'sql', 'querylink', 'delete',
            ]}
            queries={this.state.favedQueries}
            actions={this.props.actions}
            onDelete={this.deleteQuery.bind(this)}
          />
        </div>
      </div>
    );
  }
}

FaveQueries.propTypes = propTypes;

export default FaveQueries;
