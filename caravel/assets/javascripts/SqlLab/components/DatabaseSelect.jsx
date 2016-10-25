const $ = window.$ = require('jquery');
import React from 'react';
import Select from 'react-select';

class DatabaseSelect extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      databaseLoading: false,
      databaseOptions: [],
    };
  }
  componentDidMount() {
    this.fetchDatabaseOptions();
  }
  changeDb(db) {
    this.props.onChange(db);
  }
  fetchDatabaseOptions() {
    this.setState({ databaseLoading: true });
    const url = '/databaseasync/api/read?_flt_0_expose_in_sqllab=1';
    $.get(url, (data) => {
      const options = data.result.map((db) => ({ value: db.id, label: db.database_name }));
      this.setState({ databaseOptions: options, databaseLoading: false });
      this.props.actions.setDatabases(data.result);
    });
  }
  render() {
    return (
      <div>
        <Select
          name="select-db"
          placeholder={`Select a database (${this.state.databaseOptions.length})`}
          options={this.state.databaseOptions}
          value={this.props.databaseId}
          isLoading={this.state.databaseLoading}
          autosize={false}
          onChange={this.changeDb.bind(this)}
          valueRenderer={this.props.valueRenderer}
        />
      </div>
    );
  }
}

DatabaseSelect.propTypes = {
  onChange: React.PropTypes.func,
  actions: React.PropTypes.object,
  databaseId: React.PropTypes.number,
  valueRenderer: React.PropTypes.func,
};

export default DatabaseSelect;
