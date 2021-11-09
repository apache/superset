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
import { t } from '@superset-ui/core';
import { Zoom } from '@vx/zoom';
import { localPoint } from '@vx/event';
import { RectClipPath } from '@vx/clip-path';
import { withTooltip } from '@vx/tooltip';
import { keyBy } from 'lodash';
import { geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { WithTooltipProvidedProps } from '@vx/tooltip/lib/enhancers/withTooltip';
import loadMap from './loadMap';
import MapMetadata from './MapMetadata';
import {
  PADDING,
  RelativeDiv,
  IconButton,
  TextButton,
  ZoomControls,
  MiniMapControl,
} from './components';
import {
  ChoroplethMapEncoding,
  choroplethMapEncoderFactory,
  DefaultChannelOutputs,
} from './Encoder';
import MapTooltip, { MapDataPoint } from './MapTooltip';

const INITIAL_TRANSFORM = {
  scaleX: 1,
  scaleY: 1,
  translateX: 0,
  translateY: 0,
  skewX: 0,
  skewY: 0,
};

/**
 * These props should be stored when saving the chart.
 */
export type ChoroplethMapVisualProps = {
  encoding?: Partial<ChoroplethMapEncoding>;
  map?: string;
};

export type ChoroplethMapProps = ChoroplethMapVisualProps &
  WithTooltipProvidedProps<MapDataPoint> & {
    data: Record<string, unknown>[];
    height: number;
    width: number;
  };

const defaultProps = {
  data: [],
  encoding: {},
  map: 'world',
};

const missingItem = DefaultChannelOutputs;

class ChoroplethMap extends React.PureComponent<
  ChoroplethMapProps & typeof defaultProps,
  {
    mapShape?: {
      metadata: MapMetadata;
      object: FeatureCollection;
    };
    mapData: {
      [key: string]: MapDataPoint;
    };
    showMiniMap: boolean;
  }
> {
  static defaultProps = defaultProps;

  createEncoder = choroplethMapEncoderFactory.createSelector();

  constructor(props: ChoroplethMapProps & typeof defaultProps) {
    super(props);

    this.state = {
      mapData: {},
      mapShape: undefined,
      showMiniMap: true,
    };
  }

  componentDidMount() {
    this.loadMap();
    this.processData();
  }

  componentDidUpdate(prevProps: ChoroplethMapProps) {
    if (prevProps.map !== this.props.map) {
      this.loadMap();
    }
    if (
      prevProps.data !== this.props.data ||
      prevProps.encoding !== this.props.encoding
    ) {
      this.processData();
    }
  }

  handleMouseOver = (
    event: React.MouseEvent<SVGPathElement>,
    datum?: MapDataPoint,
  ) => {
    const coords = localPoint(event);
    this.props.showTooltip({
      tooltipLeft: coords?.x,
      tooltipTop: coords?.y,
      tooltipData: datum,
    });
  };

  toggleMiniMap = () => {
    const { showMiniMap } = this.state;
    this.setState({
      showMiniMap: !showMiniMap,
    });
  };

  processData() {
    const { data, encoding } = this.props;
    const encoder = this.createEncoder(encoding);
    const { key, fill, opacity, stroke, strokeWidth } = encoder.channels;

    encoder.setDomainFromDataset(data);

    const mapData = keyBy(
      data.map(d => ({
        key: key.getValueFromDatum<string>(d, DefaultChannelOutputs.key),
        fill: fill.encodeDatum(d, DefaultChannelOutputs.fill),
        opacity: opacity.encodeDatum(d, DefaultChannelOutputs.opacity),
        stroke: stroke.encodeDatum(d, DefaultChannelOutputs.stroke),
        strokeWidth: strokeWidth.encodeDatum(
          d,
          DefaultChannelOutputs.strokeWidth,
        ),
        datum: d,
      })),
      d => d.key,
    );

    this.setState({ mapData });
  }

  loadMap() {
    const { map } = this.props;
    this.setState({ mapShape: undefined });
    loadMap(map).then(mapShape => {
      this.setState({ mapShape });
    });
  }

  renderMap() {
    const { height, width, hideTooltip } = this.props;
    const { mapShape, mapData } = this.state;

    if (typeof mapShape !== 'undefined') {
      const { metadata, object } = mapShape;
      const { keyAccessor } = metadata;
      const projection = metadata.createProjection().fitExtent(
        [
          [PADDING, PADDING],
          [width - PADDING * 2, height - PADDING * 2],
        ],
        object,
      );
      const path = geoPath().projection(projection);

      return object.features.map(f => {
        const key = keyAccessor(f);
        const encodedDatum = mapData[key] || missingItem;
        const { stroke, fill, strokeWidth, opacity } = encodedDatum;

        return (
          // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
          <path
            key={key}
            vectorEffect="non-scaling-stroke"
            stroke={stroke}
            strokeWidth={strokeWidth}
            fill={fill}
            opacity={opacity}
            d={path(f) || ''}
            onMouseOver={event => this.handleMouseOver(event, encodedDatum)}
            onMouseMove={event => this.handleMouseOver(event, encodedDatum)}
            onMouseOut={hideTooltip}
            onBlur={hideTooltip}
          />
        );
      });
    }

    return null;
  }

  render() {
    const {
      height,
      width,
      encoding,
      tooltipOpen,
      tooltipLeft,
      tooltipTop,
      tooltipData,
    } = this.props;
    const { showMiniMap } = this.state;
    const encoder = this.createEncoder(encoding);

    const renderedMap = this.renderMap();
    const miniMapTransform = `translate(${(width * 3) / 4 - PADDING}, ${
      (height * 3) / 4 - PADDING
    }) scale(0.25)`;

    return (
      <>
        <Zoom
          style={{ width, height }}
          width={width}
          height={height}
          scaleXMin={0.75}
          scaleXMax={8}
          scaleYMin={0.75}
          scaleYMax={8}
          transformMatrix={INITIAL_TRANSFORM}
        >
          {zoom => (
            <RelativeDiv>
              <svg
                width={width}
                height={height}
                style={{ cursor: zoom.isDragging ? 'grabbing' : 'grab' }}
              >
                <RectClipPath id="zoom-clip" width={width} height={height} />
                <g
                  onWheel={zoom.handleWheel}
                  // eslint-disable-next-line react/jsx-handler-names
                  onMouseDown={zoom.dragStart}
                  // eslint-disable-next-line react/jsx-handler-names
                  onMouseMove={zoom.dragMove}
                  // eslint-disable-next-line react/jsx-handler-names
                  onMouseUp={zoom.dragEnd}
                  onMouseLeave={() => {
                    if (!zoom.isDragging) return;
                    zoom.dragEnd();
                  }}
                  onDoubleClick={event => {
                    const point = localPoint(event) || undefined;
                    zoom.scale({ scaleX: 1.1, scaleY: 1.1, point });
                  }}
                >
                  <rect width={width} height={height} fill="transparent" />
                  <g transform={zoom.toString()}>{renderedMap}</g>
                </g>
                {showMiniMap && (
                  <g clipPath="url(#zoom-clip)" transform={miniMapTransform}>
                    <rect
                      width={width}
                      height={height}
                      fill="#fff"
                      stroke="#999"
                    />
                    {renderedMap}
                    <rect
                      width={width}
                      height={height}
                      fill="white"
                      fillOpacity={0.2}
                      stroke="#999"
                      strokeWidth={4}
                      transform={zoom.toStringInvert()}
                    />
                  </g>
                )}
              </svg>
              <ZoomControls>
                <IconButton
                  type="button"
                  onClick={() => zoom.scale({ scaleX: 1.2, scaleY: 1.2 })}
                >
                  +
                </IconButton>
                <IconButton
                  type="button"
                  onClick={() => zoom.scale({ scaleX: 0.8, scaleY: 0.8 })}
                >
                  -
                </IconButton>
                <TextButton
                  type="button"
                  // eslint-disable-next-line react/jsx-handler-names
                  onClick={zoom.clear}
                >
                  Reset
                </TextButton>
              </ZoomControls>
              <MiniMapControl>
                <TextButton
                  type="button"
                  // eslint-disable-next-line react/jsx-handler-names
                  onClick={this.toggleMiniMap}
                >
                  {showMiniMap ? t('Hide Mini Map') : t('Show Mini Map')}
                </TextButton>
              </MiniMapControl>
            </RelativeDiv>
          )}
        </Zoom>
        {tooltipOpen && (
          <MapTooltip
            encoder={encoder}
            top={tooltipTop}
            left={tooltipLeft}
            tooltipData={tooltipData}
          />
        )}
      </>
    );
  }
}

export default withTooltip(ChoroplethMap);
