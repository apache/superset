import React from 'react';
import PropTypes from 'prop-types';
import { Button, Panel, Grid, Row, Col } from 'react-bootstrap';
import Select from 'react-virtualized-select';

import controls from '../explorev2/stores/controls';

const propTypes = {
  datasources: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
  })).isRequired,
};

class AddSliceContainer extends React.Component {
  constructor(props) {
    super(props);
    this.vizTypeOptions = controls.viz_type.choices.map(vt => ({ label: vt[1], value: vt[0] }));
    this.state = {
      datasourceValue: this.props.datasources[0].value,
      datasourceId: this.props.datasources[0].value.split('__')[0],
      datasourceType: this.props.datasources[0].value.split('__')[1],
      visType: 'table',
    };
  }

  gotoSlice() {
    const baseUrl = `/superset/explore/${this.state.datasourceType}/${this.state.datasourceId}`;
    const formData = encodeURIComponent(JSON.stringify({ viz_type: this.state.visType }));
    const exploreUrl = `${baseUrl}?form_data=${formData}`;
    window.location.href = exploreUrl;
  }

  changeDatasource(e) {
    this.setState({
      datasourceValue: e.value,
      datasourceId: e.value.split('__')[0],
      datasourceType: e.value.split('__')[1],
    });
  }

  changeSliceName(e) {
    this.setState({ sliceName: e.target.value });
  }

  changeVisType(e) {
    this.setState({ visType: e.value });
  }

  render() {
    return (
      <div className="container">
        <Panel header={<h3>Create a new slice</h3>}>
          <Grid>
            <Row>
              <Col xs={12} sm={6}>
                <div>
                  <p>Choose a datasource</p>
                  <Select
                    clearable={false}
                    name="select-datasource"
                    onChange={this.changeDatasource.bind(this)}
                    options={this.props.datasources}
                    placeholder="Choose a datasource"
                    value={this.state.datasourceValue}
                  />
                </div>
                <br />
                <div>
                  <p>Choose a visualization type</p>
                  <Select
                    clearable={false}
                    name="select-vis-type"
                    onChange={this.changeVisType.bind(this)}
                    options={this.vizTypeOptions}
                    placeholder="Choose a visualization type"
                    value={this.state.visType}
                  />
                </div>
                <br />
                <Button bsStyle="primary" onClick={this.gotoSlice.bind(this)}>
                  Create new slice
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

export default AddSliceContainer;
