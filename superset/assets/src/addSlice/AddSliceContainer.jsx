import React from 'react';
import PropTypes from 'prop-types';
import { Button, Panel } from 'react-bootstrap';
import Select from 'react-virtualized-select';
import { t } from '@superset-ui/translation';
import { getChartMetadataRegistry } from '@superset-ui/chart';

const propTypes = {
  datasources: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })).isRequired,
};

const styleSelectWidth = { width: 300 };

export default class AddSliceContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      visType: 'table',
    };

    this.changeDatasource = this.changeDatasource.bind(this);
    this.changeVisType = this.changeVisType.bind(this);
    this.gotoSlice = this.gotoSlice.bind(this);
  }

  exploreUrl() {
    const formData = encodeURIComponent(
      JSON.stringify({
        viz_type: this.state.visType,
        datasource: this.state.datasourceValue,
      }));
    return `/superset/explore/?form_data=${formData}`;
  }

  gotoSlice() {
    window.location.href = this.exploreUrl();
  }

  changeDatasource(e) {
    this.setState({
      datasourceValue: e.value,
      datasourceId: e.value.split('__')[0],
      datasourceType: e.value.split('__')[1],
    });
  }

  changeVisType(e) {
    this.setState({ visType: e.value });
  }

  isBtnDisabled() {
    return !(this.state.datasourceId && this.state.visType);
  }

  render() {
    const types = getChartMetadataRegistry().entries()
      .map(({ key, value }) => ({
        value: key,
        label: value.name,
      }));

    return (
      <div className="container">
        <Panel header={<h3>{t('Create a new chart')}</h3>}>
          <div>
            <p>{t('Choose a datasource')}</p>
            <div style={styleSelectWidth}>
              <Select
                clearable={false}
                style={styleSelectWidth}
                name="select-datasource"
                onChange={this.changeDatasource}
                options={this.props.datasources}
                placeholder={t('Choose a datasource')}
                value={this.state.datasourceValue}
                width={200}
              />
            </div>
            <p className="text-muted">
              {t(
                'If the datasource your are looking for is not ' +
                'available in the list, ' +
                'follow the instructions on the how to add it on the ')}
              <a href="http://superset.apache.org/tutorial.html">{t('Superset tutorial')}</a>
            </p>
          </div>
          <br />
          <div>
            <p>{t('Choose a visualization type')}</p>
            <Select
              clearable={false}
              name="select-vis-type"
              style={styleSelectWidth}
              onChange={this.changeVisType}
              options={types}
              placeholder={t('Choose a visualization type')}
              value={this.state.visType}
            />
          </div>
          <br />
          <Button
            bsStyle="primary"
            disabled={this.isBtnDisabled()}
            onClick={this.gotoSlice}
          >
            {t('Create new chart')}
          </Button>
          <br /><br />
        </Panel>
      </div>
    );
  }
}

AddSliceContainer.propTypes = propTypes;
