/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable camelcase */
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
import { isEqual } from 'lodash';
import {
  Datasource,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import { Layer } from 'deck.gl/typed';

import {
  DeckGLContainer,
  DeckGLContainerStyledWrapper,
} from '../DeckGLContainer';
import { getExploreLongUrl } from '../utils/explore';
import layerGenerators from '../layers';
import { Viewport } from '../utils/fitViewport';
import { TooltipProps } from '../components/Tooltip';

export type DeckMultiProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
  datasource: Datasource;
  onSelect: () => void;
};

export type DeckMultiState = {
  subSlicesLayers: Record<number, Layer>;
  viewport?: Viewport;
};

class DeckMulti extends React.PureComponent<DeckMultiProps, DeckMultiState> {
  containerRef = React.createRef<DeckGLContainer>();

  constructor(props: DeckMultiProps) {
    super(props);
    this.state = { subSlicesLayers: {} };
    this.onViewportChange = this.onViewportChange.bind(this);
  }

  componentDidMount() {
    const { formData, payload } = this.props;
    this.loadLayers(formData, payload);
  }

  UNSAFE_componentWillReceiveProps(nextProps: DeckMultiProps) {
    const { formData, payload } = nextProps;
    const hasChanges = !isEqual(
      this.props.formData.deck_slices,
      nextProps.formData.deck_slices,
    );
    if (hasChanges) {
      this.loadLayers(formData, payload);
    }
  }

  onViewportChange(viewport: Viewport) {
    this.setState({ viewport });
  }

  loadLayers(
    formData: QueryFormData,
    payload: JsonObject,
    viewport?: Viewport,
  ) {
    this.setState({ subSlicesLayers: {}, viewport });
    payload.data.slices.forEach(
      (subslice: { slice_id: number } & JsonObject) => {
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

        const url = getExploreLongUrl(subsliceCopy.form_data, 'json');

        if (url) {
          SupersetClient.get({
            endpoint: url,
          })
            .then(({ json }) => {
              const layer = layerGenerators[subsliceCopy.form_data.viz_type](
                subsliceCopy.form_data,
                json,
                this.props.onAddFilter,
                this.setTooltip,
                this.props.datasource,
                [],
                this.props.onSelect,
              );
              this.setState({
                subSlicesLayers: {
                  ...this.state.subSlicesLayers,
                  [subsliceCopy.slice_id]: layer,
                },
              });
            })
            .catch(() => {});
        }
      },
    );
  }

  setTooltip = (tooltip: TooltipProps['tooltip']) => {
    const { current } = this.containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  };

  render() {
    const { payload, formData, setControlValue, height, width } = this.props;
    const { subSlicesLayers } = this.state;

    const layers = Object.values(subSlicesLayers);

    return (
      <DeckGLContainerStyledWrapper
        ref={this.containerRef}
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={this.state.viewport || this.props.viewport}
        layers={layers}
        mapStyle={formData.mapbox_style}
        setControlValue={setControlValue}
        onViewportChange={this.onViewportChange}
        height={height}
        width={width}
      />
    );
  }
}

export default DeckMulti;
