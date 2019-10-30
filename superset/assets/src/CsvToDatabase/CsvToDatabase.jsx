/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import Asterisk from 'src/components/Asterisk';
import FileDropper from 'src/components/FileDropper/FileDropper';
import DropArea from 'src/components/FileDropper/DropArea';
import Select from 'react-virtualized-select';
import Button from 'src/components/Button';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import withToasts from '../messageToasts/enhancers/withToasts';
import * as Actions from './actions/csvToDatabase';

const propTypes = {
  databases: PropTypes.array.isRequired,
  actions: PropTypes.object.isRequired,
};

export class CsvToDatabase extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      tableName: '',
      file: undefined,
      selectedConnection: { label: 'In a new database', value: -1 },
      schema: '',
      delimiter: ',',
      selectedTableExists: { label: 'Fail', value: 'Fail' },
      headerRow: 0,
      decimalCharacter: '.',
      tableExistsValues: [
        { label: 'Fail', value: 'Fail' },
        { label: 'Replace', value: 'Replace' },
        { label: 'Append', value: 'Append' },
      ], // TODO: Check if those values can be passed to this view
    };
    this.setFile = this.setFile.bind(this);
    this.setSelectedConnection = this.setSelectedConnection.bind(this);
    this.setTableExists = this.setTableExists.bind(this);
    this.setUserInput = this.setUserInput.bind(this);
    this.setSchema = this.setSchema.bind(this);
    this.getConnectionStrings = this.getConnectionStrings.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  setFile(file) {
    if (file) {
      this.setState({ file: file[0] });
    }
  }

  setSelectedConnection(connection) {
    this.setState({ selectedConnection: connection });
  }

  setTableExists(value) {
    this.setState({ selectedTableExists: value });
  }

  setUserInput(event) {
    const name = event.target.name;
    const value = event.target.value;
    this.setState({ [name]: value });
  }

  setSchema(event) {
    // TODO: Schema check from forms
    this.setUserInput(event);
  }

  getConnectionStrings() {
    const connections = [];
    this.props.databases.forEach(database =>
      connections.push({ label: database.name, value: database.id }),
    );
    return connections;
  }

  handleSubmit(event) {
    event.preventDefault();
    const {
      tableName,
      file,
      selectedConnection,
      schema,
      delimiter,
      selectedTableExists,
      headerRow,
      decimalCharacter,
    } = this.state;
    this.props.actions.uploadCsv({
      tableName,
      file,
      connectionId: selectedConnection.value,
      schema,
      delimiter,
      ifTableExists: selectedTableExists.value,
      headerRow,
      decimalCharacter,
    });
  }

  render() {
    return (
      <div className="container">
        <div className="panel panel-primary">
          <div className="panel-heading">
            <h4 className="panel-title">CSV to Database configuration</h4>
          </div>
          <div id="Home" className="tab-pane active">
            <form
              id="model_form"
              method="post"
              encType="multipart/form-data"
              onSubmit={this.handleSubmit}
            >
              <div className="table-responsive">
                <table className="table table-bordered">
                  <tbody>
                    <tr>
                      <td className="col-lg-2">
                        Table Name <Asterisk />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          id="tableName"
                          name="tableName"
                          placeholder="Table Name"
                          required
                          type="text"
                          value={this.state.tableName}
                          onChange={this.setUserInput}
                        />
                        <span className="help-block">
                          Name of the table to be created from csv data.
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        CSV File <Asterisk />
                      </td>
                      <td>
                        <FileDropper
                          onFileSelected={this.setFile}
                          allowedMimeTypes={['text/csv']}
                        >
                          <DropArea
                            isVisible
                            showFileSelected
                            fileName={
                              this.state.file ? this.state.file.name : undefined
                            }
                          />
                        </FileDropper>
                        <span className="help-block">
                          Select a CSV file to be uploaded to a database.
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">Database</td>
                      <td>
                        <Select
                          value={this.state.selectedConnection}
                          onChange={this.setSelectedConnection}
                          options={this.getConnectionStrings()}
                          clearable={false}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">Schema</td>
                      <td>
                        <input
                          className="form-control"
                          id="schema"
                          name="schema"
                          placeholder="Schema"
                          type="text"
                          value={this.state.schema}
                          onChange={this.setSchema}
                        />
                        <span className="help-block">
                          Specify a schema (if database flavor supports this)
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        Delimiter <Asterisk />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          id="delimiter"
                          name="delimiter"
                          placeholder="Delimiter"
                          required
                          type="text"
                          value={this.state.delimiter}
                          onChange={this.setUserInput}
                        />
                        <span className="help-block">
                          Delimiter used by CSV file (for whitespace use \s++)
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        Table Exists <Asterisk />
                      </td>
                      <td>
                        <Select
                          value={this.state.selectedTableExists}
                          onChange={this.setTableExists}
                          options={this.state.tableExistsValues}
                          clearable={false}
                        />
                        <span className="help-block">
                          If table exists do one of the following: Fail (do
                          nothing), Replace (drop and recreate table) or Append
                          (insert data)
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">Header Row</td>
                      <td>
                        <input
                          className="form-control"
                          id="headerRow"
                          name="headerRow"
                          placeholder="Header Row"
                          type="number"
                          value={this.state.headerRow}
                          onChange={this.setUserInput}
                        />
                        <span className="help-block">
                          Row containing the headers to use as column names (0
                          is first line of data). Leave empty if there is no
                          header row.
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">Decimal Character</td>
                      <td>
                        <input
                          className="form-control"
                          id="decimalCharacter"
                          name="decimalCharacter"
                          placeholder="Decimal Character"
                          type="text"
                          value={this.state.decimalCharacter}
                          onChange={this.setUserInput}
                        />
                        <span className="help-block">
                          Character to interpret as decimal point.
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="well well-sm">
                <Button bsStyle="primary" type="submit">
                  Save <i className="fa fa-save" />
                </Button>
                <Button href="/back">
                  Back <i className="fa fa-arrow-left" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

CsvToDatabase.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(
  null,
  mapDispatchToProps,
)(withToasts(CsvToDatabase));
