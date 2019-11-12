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
};

export class GeocodingForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      datasource: undefined,
      longitudeColumnName: 'longitude',
      latitudeColumnName: 'latitude',
      overwriteIfExists: false,
      saveOnErrorOrInterrupt: true,
    };
    this.getDatasources = this.getDatasources.bind(this);
    this.setPropertyValue = this.setPropertyValue.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  getDatasources() {
    const { tables } = this.props;
    const tableArray = [];
    tables.forEach(table =>
      tableArray.push({ label: table.name, value: table.name }),
    );
    return tableArray;
  }

  setPropertyValue(name, value) {
    this.setState({ [name]: value });
  }

  handleSubmit() {

  }

  render() {
    return (
      <div className="container">
        <FormError />
        <div className="panel panel-primary">
          <div className="panel-heading">
            <h4 className="panel-title">{t('Geocode Addresses')}</h4>
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
                        {t('Datasource')} <Asterisk />
                      </td>
                      <td>
                        <FormSelect
                          id={'datasource'}
                          options={this.getDatasources()}
                          onChange={value =>
                            this.setPropertyValue('datasource', value)
                          }
                          value={this.state.datasource}
                        />
                      </td>
                    </tr>
                    {/* TODO: Load column data when datasource is selected */}
                    <tr className={this.state.datasource ? null : 'hide-component'}>
                      <td className="col-lg-2">{t('Street Column')}</td>
                      <td>
                        <FormSelect
                          id={'streetColumn'}
                          helpText={t(
                            'Name of the column where the street is stored.',
                          )}
                        />
                      </td>
                    </tr>
                    <tr className={this.state.datasource ? null : 'hide-component'}>
                      <td className="col-lg-2">{t('ZIP code Column')}</td>
                      <td>
                        <FormSelect
                          id={'zipColumn'}
                          helpText={t(
                            'Name of the column where the ZIP code is stored.',
                          )}
                        />
                      </td>
                    </tr>
                    <tr className={this.state.datasource ? null : 'hide-component'}>
                      <td className="col-lg-2">{t('City Column')}</td>
                      <td>
                        <FormSelect
                          id={'cityColumn'}
                          helpText={t(
                            'Name of the column where the city is stored.',
                          )}
                        />
                      </td>
                    </tr>
                    <tr className={this.state.datasource ? null : 'hide-component'}>
                      <td className="col-lg-2">{t('Country Column')}</td>
                      <td>
                        <FormSelect
                          id={'countryColumn'}
                          helpText={t(
                            'Name of the column where the country is stored.',
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
                            'Name of the longitude column to add or overwrite',
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
                            'Name of the longitude column to add or overwrite',
                          )}
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="col-lg-2">
                        {t('Overwrite latitude / longitude columns')}
                      </td>
                      <td>
                        <FormCheckbox
                          checked={this.state.overwriteIfExists}
                          onChange={value =>
                            this.setPropertyValue('overwriteIfExists', value)
                          }
                          helpText={t(
                            'Overwrite latitude / longitude columns if they already exist.',
                          )}
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
                <Button bsStyle="primary" type="submit">
                  {t('Geocode')} <i className="fa fa-globe" />
                </Button>
                <Button href="/back">
                  {t('Back')} <i className="fa fa-arrow-left" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

GeocodingForm.propTypes = propTypes;

function mapStateToProps({ geocoding }) {
  return { geocoding: geocoding.geocoding };
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
