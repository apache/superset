const $ = window.$ = require('jquery');
import React from 'react';
import Select from 'react-select';

const propTypes = {
  onChange: React.PropTypes.func,
  actions: React.PropTypes.object,
  databaseId: React.PropTypes.number,
  valueRenderer: React.PropTypes.func,
};

class DatabaseSelect extends React.PureComponent {
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
      if (data.result.length === 0) {
        this.props.actions.addAlert({
          bsStyle: 'danger',
          msg: "It seems you don't have access to any database",
        });
      }
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

DatabaseSelect.propTypes = propTypes;

export default DatabaseSelect;
