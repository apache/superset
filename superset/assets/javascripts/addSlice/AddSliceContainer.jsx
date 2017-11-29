import React from 'react';
import PropTypes from 'prop-types';
import { Button, Panel, Grid, Row, Col } from 'react-bootstrap';
import Select from 'react-virtualized-select';
import visTypes from '../explore/stores/visTypes';
import { t } from '../locales';

const propTypes = {
  datasources: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })).isRequired,
};

export default class AddSliceContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    const visTypeKeys = Object.keys(visTypes);
    this.vizTypeOptions = visTypeKeys.map(vt => ({ label: visTypes[vt].label, value: vt }));
    this.state = {
      visType: 'table',
    };
  }

  exploreUrl() {
    const baseUrl = `/superset/explore/${this.state.datasourceType}/${this.state.datasourceId}`;
    const formData = encodeURIComponent(JSON.stringify({ viz_type: this.state.visType }));
    return `${baseUrl}?form_data=${formData}`;
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
    return (
      <div className="container">
        <Panel header={<h3>{t('Create a new slice')}</h3>}>
          <Grid>
            <Row>
              <Col xs={12} sm={6}>
                <div>
                  <p>{t('Choose a datasource')}</p>
                  <Select
                    clearable={false}
                    name="select-datasource"
                    onChange={this.changeDatasource.bind(this)}
                    options={this.props.datasources}
                    placeholder={t('Choose a datasource')}
                    value={this.state.datasourceValue}
                  />
                </div>
                <br />
                <div>
                  <p>{t('Choose a visualization type')}</p>
                  <Select
                    clearable={false}
                    name="select-vis-type"
                    onChange={this.changeVisType.bind(this)}
                    options={this.vizTypeOptions}
                    placeholder={t('Choose a visualization type')}
                    value={this.state.visType}
                  />
                </div>
                <br />
                <Button
                  bsStyle="primary"
                  disabled={this.isBtnDisabled()}
                  onClick={this.gotoSlice.bind(this)}
                >
                  {t('Create new slice')}
                </Button>
                <br /><br />
              </Col>
            </Row>
          </Grid>
        </Panel>
      </div>
    );
  }
}

AddSliceContainer.propTypes = propTypes;
