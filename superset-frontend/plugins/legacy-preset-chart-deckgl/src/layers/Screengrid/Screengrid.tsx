/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
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
/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import { ScreenGridLayer } from 'deck.gl/typed';
import { JsonObject, JsonValue, QueryFormData, t } from '@superset-ui/core';
import { noop } from 'lodash';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
// eslint-disable-next-line import/extensions
import fitViewport, { Viewport } from '../../utils/fitViewport';
import {
  DeckGLContainer,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import { TooltipProps } from '../../components/Tooltip';

function getPoints(data: JsonObject[]) {
  return data.map(d => d.position);
}

function setTooltipContent(o: JsonObject) {
  return (
    <div className="deckgl-tooltip">
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Longitude and Latitude') + ': '}
        value={`${o.coordinate[0]}, ${o.coordinate[1]}`}
      />
      <TooltipRow
        // eslint-disable-next-line prefer-template
        label={t('Weight') + ': '}
        value={`${o.object.cellWeight}`}
      />
    </div>
  );
}

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: () => void,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
) {
  const fd = formData;
  const c = fd.color_picker;
  let data = payload.data.features.map((d: JsonObject) => ({
    ...d,
    color: [c.r, c.g, c.b, 255 * c.a],
  }));

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  // Passing a layer creator function instead of a layer since the
  // layer needs to be regenerated at each render
  return new ScreenGridLayer({
    id: `screengrid-layer-${fd.slice_id}` as const,
    data,
    cellSizePixels: fd.grid_size,
    minColor: [c.r, c.g, c.b, 0],
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getWeight: d => d.weight || 0,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  });
}

export type DeckGLScreenGridProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  width: number;
  height: number;
  onAddFilter: () => void;
};

export type DeckGLScreenGridState = {
  viewport: Viewport;
  formData: QueryFormData;
};

class DeckGLScreenGrid extends React.PureComponent<
  DeckGLScreenGridProps,
  DeckGLScreenGridState
> {
  containerRef = React.createRef<DeckGLContainer>();

  constructor(props: DeckGLScreenGridProps) {
    super(props);

    this.state = DeckGLScreenGrid.getDerivedStateFromProps(
      props,
    ) as DeckGLScreenGridState;

    this.getLayers = this.getLayers.bind(this);
  }

  static getDerivedStateFromProps(
    props: DeckGLScreenGridProps,
    state?: DeckGLScreenGridState,
  ) {
    // the state is computed only from the payload; if it hasn't changed, do
    // not recompute state since this would reset selections and/or the play
    // slider position due to changes in form controls
    if (state && props.payload.form_data === state.formData) {
      return null;
    }

    const features = props.payload.data.features || [];

    const { width, height, formData } = props;

    let { viewport } = props;
    if (formData.autozoom) {
      viewport = fitViewport(viewport, {
        width,
        height,
        points: getPoints(features),
      });
    }

    return {
      viewport,
      formData: props.payload.form_data as QueryFormData,
    };
  }

  getLayers() {
    const layer = getLayer(
      this.props.formData,
      this.props.payload,
      noop,
      this.setTooltip,
    );

    return [layer];
  }

  setTooltip = (tooltip: TooltipProps['tooltip']) => {
    const { current } = this.containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  };

  render() {
    const { formData, payload, setControlValue } = this.props;

    return (
      <div>
        <DeckGLContainerStyledWrapper
          ref={this.containerRef}
          viewport={this.state.viewport}
          layers={this.getLayers()}
          setControlValue={setControlValue}
          mapStyle={formData.mapbox_style}
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          width={this.props.width}
          height={this.props.height}
        />
      </div>
    );
  }
}

export default DeckGLScreenGrid;
