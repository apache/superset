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
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import Asterisk from 'src/components/Asterisk';
import FileDropper from 'src/components/FileDropper/FileDropper';
import FormError from 'src/components/FormError';
import DropArea from 'src/components/FileDropper/DropArea';
import Select from 'react-virtualized-select';
import Button from 'src/components/Button';
import AdvancedOptions from 'src/components/AdvancedOptions/AdvancedOptions';
import Checkbox from 'src/components/Checkbox';
import FormInput from 'src/components/FormInput';
import * as Actions from './actions/csvToDatabase';
import './CsvToDatabase.css';

const propTypes = {
  databases: PropTypes.array.isRequired,
  actions: PropTypes.object.isRequired,
  uploadStatus: PropTypes.object,
};

export class CsvToDatabase extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      tableName: '',
      databaseName: '',
      file: undefined,
      selectedConnection: { label: 'In a new database', value: -1 },
      schema: '',
      delimiter: ',',
      selectedTableExists: { label: 'Fail', value: 'Fail' },
      headerRow:  '0',
      decimalCharacter: '.',
      tableExistsValues: [
        { label: 'Fail', value: 'Fail' },
        { label: 'Replace', value: 'Replace' },
        { label: 'Append', value: 'Append' },
      ], // TODO: Check if those values can be passed to this view
      indexColumn: '',
      mangleDuplicateColumns: true,
      skipInitialSpace: false,
      skipRows: '',
      rowsToRead: '',
      skipBlankLines: true,
      parseDates: '',
      inferDatetimeFormat: true,
      dataframeIndex: false,
      columnLabels: '',
    };
    this.setFile = this.setFile.bind(this);
    this.setSelectedConnection = this.setSelectedConnection.bind(this);
    this.setTableExists = this.setTableExists.bind(this);
    this.setUserInput = this.setUserInput.bind(this);
    this.getConnectionStrings = this.getConnectionStrings.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  setFile(file) {
    if (file && file[0]) {
      let fileName = '';
      if (this.state.selectedConnection.value === -1) {
        fileName = file[0].name.slice(0, -4);
      }
      this.setState({ file: file[0], databaseName: fileName });
    }
  }

  setSelectedConnection(connection) {
    let databaseName = '';
    if (connection.value === -1 && this.state.file) {
      databaseName = this.state.file.name.slice(0, -4);
    }
    console.log(connection, databaseName);
    this.setState({ selectedConnection: connection, databaseName: databaseName });
  }

  setTableExists(value) {
    this.setState({ selectedTableExists: value });
  }

  setUserInput(event) {
    const name = event.target.name;
    const value = event.target.value;
    this.setState({ [name]: value });
  }

  setCheckboxValue(name, value) {
    this.setState({ [name]: value });
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
      databaseName,
      file,
      selectedConnection,
      schema,
      delimiter,
      selectedTableExists,
      headerRow,
      decimalCharacter,
      indexColumn,
      mangleDuplicateColumns,
      skipInitialSpace,
      skipRows,
      rowsToRead,
      skipBlankLines,
      parseDates,
      inferDatetimeFormat,
      dataframeIndex,
      columnLabels,
    } = this.state;
    this.props.actions.uploadCsv({
      tableName,
      databaseName,
      file,
      connectionId: selectedConnection.value,
      schema,
      delimiter,
      ifTableExists: selectedTableExists.value,
      headerRow,
      decimalCharacter,
      indexColumn,
      mangleDuplicateColumns,
      skipInitialSpace,
      skipRows,
      rowsToRead,
      skipBlankLines,
      parseDates,
      inferDatetimeFormat,
      dataframeIndex,
      columnLabels,
    });
  }

  render() {
    return (
      <div className="container">
        <FormError status={this.props.uploadStatus} />
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
                        <FormInput
                        type="text"
                        name="tableName"
                        placeHolder="Table name"
                        required={true}
                        value={this.state.tableName}
                        onChange={this.setUserInput}
                        helpText="Name of the table to be created from csv data."
                        />
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
                          isRequired
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
                      <td className="col-lg-2">
                        Database <Asterisk />
                      </td>
                      <td>
                        <Select
                          value={this.state.selectedConnection}
                          onChange={this.setSelectedConnection}
                          options={this.getConnectionStrings()}
                          clearable={false}
                        />
                      </td>
                    </tr>
                    <tr
                      className={
                        this.state.selectedConnection.value === -1
                          ? null
                          : 'hide-component'
                      }
                    >
                      <td className="col-lg-2">
                        Database Name <Asterisk />
                      </td>
                      <td>
                        <FormInput
                        type="text"
                          name="databaseName"
                          placeHolder="Database Name"
                          required={this.state.selectedConnection.value === -1}
                          value={this.state.databaseName}
                          onChange={this.setUserInput}
                          helpText="Name of the database file to be created."
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">Schema</td>
                      <td>
                        <FormInput
                        type="text"
                          name="schema"
                          placeholder="Schema"
                          value={this.state.schema}
                          onChange={this.setUserInput}
                          helpText="Specify a schema (if database flavor supports this)"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        Delimiter <Asterisk />
                      </td>
                      <td>
                        <FormInput 
                        type="text"
                        name="delimiter"
                        placeholder="Delimiter"
                        required={true}
                        value={this.state.delimiter}
                        onChange={this.setUserInput}
                        helpText="Delimiter used by CSV file (for whitespace use \s++)"
                        />
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
                  </tbody>
                </table>
                <AdvancedOptions>
                  <table className="table table-bordered">
                    <tbody>
                      <tr>
                        <td className="col-lg-2">Header Row</td>
                        <td>
                          <FormInput
                          type="number"
                          name="headerRow"
                          placeholder="Header Row"
                          value={this.state.headerRow}
                          onChange={this.setUserInput}
                          helpText="Row containing the headers to use as column names (0
                            is first line of data). Leave empty if there is no
                            header row."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Index Column</td>
                        <td>
                          <FormInput 
                          type="text"
                            name="indexColumn"
                            placeholder="Index Column"
                            value={this.state.indexColumn}
                            onChange={this.setUserInput}
                            helpText="Column to use as the row labels of the dataframe.
                            Leave empty if no index column."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Mangle Duplicate Columns</td>
                        <td>
                          <Checkbox
                            checked={this.state.mangleDuplicateColumns}
                            onChange={v =>
                              this.setCheckboxValue('mangleDuplicateColumns', v)
                            }
                          />
                          <span className="help-block">
                            Specify duplicate columns as "X.0, X.1".
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Skip Initial Space</td>
                        <td>
                          <Checkbox
                            checked={this.state.skipInitialSpace}
                            onChange={v =>
                              this.setCheckboxValue('skipInitialSpace', v)
                            }
                          />
                          <span className="help-block">
                            Skip spaces after delimiter.
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Skip Rows</td>
                        <td>
                          <FormInput
                          type="text" 
                                                      name="skipRows"
                                                      placeholder="Skip Rows"
                                                      value={this.state.skipRows}
                                                      onChange={this.setUserInput}
                                                      helpText="Number of rows to skip at start of file."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Rows to Read</td>
                        <td>
                          <FormInput 
                          type="number"
                          name="rowsToRead"
                          placeholder="Rows to Read"
                          value={this.state.rowsToRead}
                          onChange={this.setUserInput}
                          helpText="Number of rows of file to read."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Skip Blank Lines</td>
                        <td>
                          <Checkbox
                            checked={this.state.skipBlankLines}
                            onChange={v =>
                              this.setCheckboxValue('skipBlankLines', v)
                            }
                          />
                          <span className="help-block">
                            Skip blank lines rather than interpreting them as
                            NaN values.
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Parse Dates</td>
                        <td>
                          <FormInput 
                            type="text"
                            name="parseDates"
                            placeholder="Parse Dates"
                            value={this.state.parseDates}
                            onChange={this.setUserInput}
                            helpText="A comma separated list of columns that should be
                            parsed as dates."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Infer Datetime Format</td>
                        <td>
                          <Checkbox
                            checked={this.state.inferDatetimeFormat}
                            onChange={v =>
                              this.setCheckboxValue('inferDatetimeFormat', v)
                            }
                          />
                          <span className="help-block">
                            Use Pandas to interpret the datetime format
                            automatically.
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Decimal Character</td>
                        <td>
                          <FormInput 
                          type="text"
                          name="decimalCharacter"
                          placeholder="Decimal Character"
                          value={this.state.decimalCharacter}
                          onChange={this.setUserInput}
                          helpText="Character to interpret as decimal point."
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Dataframe Index</td>
                        <td>
                          <Checkbox
                            checked={this.state.dataframeIndex}
                            onChange={v =>
                              this.setCheckboxValue('dataframeIndex', v)
                            }
                          />
                          <span className="help-block">
                            Write dataframe index as a column.
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="col-lg-2">Column Label(s)</td>
                        <td>
                          <FormInput 
                          type="text"
                          name="columnLabels"
                          placeholder="Column Label(s)"
                          value={this.state.columnLabels}
                          onChange={this.setUserInput}
                          helpText="Column label for index column(s). If None is given
                          and Dataframe Index is True, Index Names are used."
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </AdvancedOptions>
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

function mapStateToProps({ uploadStatus }) {
  return { uploadStatus: uploadStatus.uploadStatus };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(CsvToDatabase);
