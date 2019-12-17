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
import { t } from '@superset-ui/translation';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import Asterisk from 'src/components/Asterisk';
import Button from 'src/components/Button';
import FormInput from 'src/components/FormInput';
import FormCheckbox from 'src/components/FormCheckbox';
import FormSelect from 'src/components/FormSelect';
import FormError from 'src/components/FormError';
import * as Actions from './actions/geocoding';
import './GeocodingForm.css';

const propTypes = {
  tables: PropTypes.array.isRequired,
  actions: PropTypes.object.isRequired,
  geocoding: PropTypes.object.isRequired,
};

export class GeocodingForm extends React.Component {
  constructor(props) {
    super(props);
    const validation =
      this.props.tables.length === 0
        ? {
            message:
              'No datasource that allows DML could be found. Please contact your system administrator.',
            timestamp: Date.now(),
          }
        : undefined;
    this.state = {
      datasource: undefined,
      streetColumn: undefined,
      cityColumn: undefined,
      countryColumn: undefined,
      buildingNumberColumn: undefined,
      longitudeColumnName: 'lon',
      latitudeColumnName: 'lat',
      geocoder: { label: 'Maptiler', value: 'maptiler' },
      ifExists: { label: 'Fail', value: 'fail' },
      ifExistsValues: [
        { label: 'Fail', value: 'fail' },
        { label: 'Replace', value: 'replace' },
        { label: 'Append', value: 'append' },
      ],
      saveOnErrorOrInterrupt: true,
      validation,
      isLoading: false,
    };
    this.getDatasources = this.getDatasources.bind(this);
    this.getColumnList = this.getColumnList.bind(this);
    this.getGeocoders = this.getGeocoders.bind(this);
    this.setDatasource = this.setDatasource.bind(this);
    this.setIfExists = this.setIfExists.bind(this);
    this.setPropertyValue = this.setPropertyValue.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  getDatasources() {
    const { tables } = this.props;
    const tableArray = [];
    tables.forEach(table =>
      tableArray.push({ label: table.fullName, value: table }),
    );
    return tableArray;
  }

  getColumnList() {
    const { geocoding } = this.props;
    if (geocoding && geocoding.columnList) {
      const columnList = [];
      geocoding.columnList.forEach(column =>
        columnList.push({ label: column, value: column }),
      );
      return columnList;
    }
    return undefined;
  }

  getGeocoders() {
    return [
      { label: 'Maptiler', value: 'maptiler' },
      { label: 'Google', value: 'google' },
    ];
  }

  setDatasource(datasource) {
    if (datasource) {
      this.props.actions.getColumnsForTable(datasource.value);
    } else {
      this.props.actions.resetColumnsForTable();
    }
    this.setState({
      datasource,
      streetColumn: undefined,
      cityColumn: undefined,
      countryColumn: undefined,
      buildingNumberColumn: undefined,
    });
  }

  setIfExists(ifExists) {
    this.setState({
      ifExists,
    });
  }

  setPropertyValue(name, value) {
    this.setState({ [name]: value });
  }

  handleSubmit() {
    const {
      datasource,
      streetColumn,
      cityColumn,
      countryColumn,
      buildingNumberColumn,
      geocoder,
      longitudeColumnName,
      latitudeColumnName,
      ifExists,
      saveOnErrorOrInterrupt,
    } = this.state;
    this.setState({ isLoading: true });
    if (!datasource) {
      this.setState({
        validation: {
          message: 'You need to select a datasource',
          timestamp: Date.now(),
        },
        isLoading: false,
      });
    } else if (
      !streetColumn &&
      !cityColumn &&
      !countryColumn &&
      !buildingNumberColumn
    ) {
      this.setState({
        validation: {
          message: 'At least one column needs to be selected',
          timestamp: Date.now(),
        },
        isLoading: false,
      });
    } else {
      this.props.actions.geocode({
        datasource: datasource.value,
        geocoder: geocoder.value,
        streetColumn: streetColumn ? streetColumn.value : undefined,
        cityColumn: cityColumn ? cityColumn.value : undefined,
        countryColumn: countryColumn ? countryColumn.value : undefined,
        buildingNumberColumn: buildingNumberColumn
          ? buildingNumberColumn.value
          : undefined,
        longitudeColumnName,
        latitudeColumnName,
        ifExists: ifExists.value,
        saveOnErrorOrInterrupt,
      });
      setTimeout(() => {
        this.props.actions.geocodingProgress();
        this.setState({ isLoading: false });
      }, 100);
    }
  }

  render() {
    return (
      <>
        <FormError status={this.state.validation} />
        <div className="panel panel-primary">
          <div className="panel-heading">
            <h4 className="panel-title">{t('Geocode Addresses')}</h4>
          </div>
          <div id="Home" className="tab-pane active">
            <form id="model_form" method="post" encType="multipart/form-data">
              <div className="table-responsive">
                <table className="table table-bordered">
                  <tbody>
                    <tr>
                      <td className="col-lg-2">
                        {t('Datasource')} <Asterisk />
                      </td>
                      <td>
                        <FormSelect
                          id={'datasource'}
                          required
                          options={this.getDatasources()}
                          onChange={this.setDatasource}
                          value={this.state.datasource}
                        />
                      </td>
                    </tr>
                    <tr
                      className={
                        this.state.datasource ? null : 'disable-component'
                      }
                    >
                      <td className="col-lg-2">{t('Street column')}</td>
                      <td>
                        <FormSelect
                          id={'streetColumn'}
                          options={this.getColumnList()}
                          onChange={value =>
                            this.setPropertyValue('streetColumn', value)
                          }
                          value={this.state.streetColumn}
                          helpText={t(
                            'Name of the column where the street and possibly house number is stored  ' +
                              '. This can also be a place.',
                          )}
                          disabled={!this.state.datasource}
                        />
                      </td>
                    </tr>
                    <tr
                      className={
                        this.state.datasource ? null : 'disable-component'
                      }
                    >
                      <td className="col-lg-2">{t('City column')}</td>
                      <td>
                        <FormSelect
                          id={'cityColumn'}
                          options={this.getColumnList()}
                          onChange={value =>
                            this.setPropertyValue('cityColumn', value)
                          }
                          value={this.state.cityColumn}
                          helpText={t(
                            'Name of the column where the city is stored.',
                          )}
                          disabled={!this.state.datasource}
                        />
                      </td>
                    </tr>
                    <tr
                      className={
                        this.state.datasource ? null : 'disable-component'
                      }
                    >
                      <td className="col-lg-2">{t('Country column')}</td>
                      <td>
                        <FormSelect
                          id={'countryColumn'}
                          options={this.getColumnList()}
                          onChange={value =>
                            this.setPropertyValue('countryColumn', value)
                          }
                          value={this.state.countryColumn}
                          helpText={t(
                            'Name of the column where the country is stored.',
                          )}
                          disabled={!this.state.datasource}
                        />
                      </td>
                    </tr>
                    <tr
                      className={
                        this.state.datasource ? null : 'disable-component'
                      }
                    >
                      <td className="col-lg-2">
                        {t('Building number column')}
                      </td>
                      <td>
                        <FormSelect
                          id={'buildingNumberColumn'}
                          options={this.getColumnList()}
                          onChange={value =>
                            this.setPropertyValue('buildingNumberColumn', value)
                          }
                          value={this.state.countryColumn}
                          helpText={t(
                            'Name of the column where the building number is stored.',
                          )}
                          disabled={!this.state.datasource}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">{t('Geocoding Service')}</td>
                      <td>
                        <FormSelect
                          id={'geocoder'}
                          options={this.getGeocoders()}
                          onChange={value =>
                            this.setPropertyValue('geocoder', value)
                          }
                          value={this.state.geocoder}
                          helpText={t(
                            'The geocoding service that should be used to geocode the addresses.',
                          )}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        {t('Name of latitude column')} <Asterisk />
                      </td>
                      <td>
                        <FormInput
                          type="text"
                          required
                          value={this.state.latitudeColumnName}
                          name="latitudeColumnName"
                          onChange={event =>
                            this.setPropertyValue(
                              event.target.name,
                              event.target.value,
                            )
                          }
                          helpText={t(
                            'Name of the latitude column to add or overwrite.',
                          )}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        {t('Name of longitude column')} <Asterisk />
                      </td>
                      <td>
                        <FormInput
                          type="text"
                          required
                          value={this.state.longitudeColumnName}
                          name="longitudeColumnName"
                          onChange={event =>
                            this.setPropertyValue(
                              event.target.name,
                              event.target.value,
                            )
                          }
                          helpText={t(
                            'Name of the longitude column to add or overwrite.',
                          )}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        {t('Overwrite latitude / longitude columns')}
                      </td>
                      <td>
                        <FormSelect
                          id={'ifExists'}
                          options={this.state.ifExistsValues}
                          onChange={this.setIfExists}
                          value={this.state.ifExists}
                          helpText={t(
                            'If columns already exist: fail, replace existing values, append only new values',
                          )}
                          clearable={false}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        {t('Save on error / interrupt')}
                      </td>
                      <td>
                        <FormCheckbox
                          checked={this.state.saveOnErrorOrInterrupt}
                          onChange={value =>
                            this.setPropertyValue(
                              'saveOnErrorOrInterrupt',
                              value,
                            )
                          }
                          helpText={t(
                            'Save already geocoded data if an error happens or the process is interrupted.',
                          )}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="well well-sm">
                <Button
                  bsStyle="primary"
                  onClick={this.handleSubmit}
                  disabled={this.state.isLoading}
                >
                  {this.state.isLoading ? t('Sending...') : t('Geocode')}{' '}
                  <i className="fa fa-globe" />
                </Button>
                <Button href="/back">
                  {t('Back')} <i className="fa fa-arrow-left" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </>
    );
  }
}

GeocodingForm.propTypes = propTypes;

function mapStateToProps({ geocoding }) {
  return { geocoding };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(GeocodingForm);
