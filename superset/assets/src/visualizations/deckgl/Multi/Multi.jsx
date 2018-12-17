import React from 'react';
import PropTypes from 'prop-types';
import { SupersetClient } from '@superset-ui/connection';

import DeckGLContainer from '../DeckGLContainer';
import { getExploreLongUrl } from '../../../explore/exploreUtils';
import layerGenerators from '../layers';

const propTypes = {
  formData: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
};

class DeckMulti extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { subSlicesLayers: {} };
  }

  componentDidMount() {
    const { formData, payload } = this.props;
    this.loadLayers(formData, payload);
  }

  componentWillReceiveProps(nextProps) {
    const { formData, payload } = nextProps;
    this.loadLayers(formData, payload);
  }

  loadLayers(formData, payload) {
    this.setState({ subSlicesLayers: {} });
    payload.data.slices.forEach((subslice) => {
      // Filters applied to multi_deck are passed down to underlying charts
      // note that dashboard contextual information (filter_immune_slices and such) aren't
      // taken into consideration here
      const filters = [
        ...(subslice.form_data.filters || []),
        ...(formData.filters || []),
        ...(formData.extra_filters || []),
      ];
      const subsliceCopy = {
        ...subslice,
        form_data: {
          ...subslice.form_data,
          filters,
        },
      };

      SupersetClient.get({
          endpoint: getExploreLongUrl(subsliceCopy.form_data, 'json'),
        })
        .then(({ json }) => {
          const layer = layerGenerators[subsliceCopy.form_data.viz_type](
            subsliceCopy.form_data,
            json,
          );
          this.setState({
            subSlicesLayers: {
              ...this.state.subSlicesLayers,
              [subsliceCopy.slice_id]: layer,
            },
          });
        })
        .catch(() => {});
    });
  }

  render() {
    const { payload, viewport, formData, setControlValue } = this.props;
    const { subSlicesLayers } = this.state;

    const layers = Object.values(subSlicesLayers);

    return (
      <DeckGLContainer
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={viewport}
        layers={layers}
        mapStyle={formData.mapbox_style}
        setControlValue={setControlValue}
      />
    );
  }
}

DeckMulti.propTypes = propTypes;

export default DeckMulti;
