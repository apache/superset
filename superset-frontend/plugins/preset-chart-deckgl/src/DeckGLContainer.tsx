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
import {
  forwardRef,
  memo,
  ReactNode,
  MouseEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  isValidElement,
} from 'react';
import { isEqual } from 'lodash';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import { Map as MapboxMap } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import type { Layer } from '@deck.gl/core';
import { JsonObject, JsonValue, usePrevious } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import DeckGLOverlayMapLibre from './components/DeckGLOverlayMapLibre';
import DeckGLOverlayMapbox from './components/DeckGLOverlayMapbox';
import Tooltip, { TooltipProps } from './components/Tooltip';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Viewport } from './utils/fitViewport';

const TICK = 250; // milliseconds

const DEFAULT_MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export type DeckGLContainerProps = {
  viewport: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  mapProvider?: 'maplibre' | 'mapbox';
  mapboxApiKey?: string;
  children?: ReactNode;
  width: number;
  height: number;
  layers: (Layer | (() => Layer))[];
  onViewportChange?: (viewport: Viewport) => void;
};

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [viewState, setViewState] = useState(props.viewport);
    const prevViewport = usePrevious(props.viewport);

    useImperativeHandle(ref, () => ({ setTooltip }), []);

    const tick = useCallback(() => {
      // Rate limiting updating viewport controls as it triggers lots of renders
      if (lastUpdate && Date.now() - lastUpdate > TICK) {
        const setCV = props.setControlValue;
        if (setCV) {
          setCV('viewport', viewState);
        }
        setLastUpdate(null);
      }
    }, [lastUpdate, props.setControlValue, viewState]);

    useEffect(() => {
      const timer = setInterval(tick, TICK);
      return () => clearInterval(timer);
    }, [tick]);

    useEffect(() => {
      if (!isEqual(props.viewport, prevViewport)) {
        setViewState(props.viewport);
      }
    }, [prevViewport, props.viewport]);

    const onMove = useCallback((evt: { viewState: JsonObject }) => {
      setViewState(evt.viewState as Viewport);
      setLastUpdate(Date.now());
    }, []);

    const layers = useCallback(() => {
      // Support for layer factory
      if (props.layers.some(l => typeof l === 'function')) {
        return props.layers.map(l =>
          typeof l === 'function' ? l() : l,
        ) as Layer[];
      }

      return props.layers as Layer[];
    }, [props.layers]);

    const isCustomTooltip = (content: ReactNode): boolean =>
      isValidElement(content) &&
      content.props?.['data-tooltip-type'] === 'custom';

    const renderTooltip = (tooltipState: TooltipProps['tooltip']) => {
      if (!tooltipState) return null;

      if (isCustomTooltip(tooltipState.content)) {
        return <Tooltip tooltip={tooltipState} variant="custom" />;
      }

      return <Tooltip tooltip={tooltipState} />;
    };

    const theme = useTheme();
    const { children = null, height, width } = props;
    const isMapbox = props.mapProvider === 'mapbox';
    const mapStyle = props.mapStyle || DEFAULT_MAP_STYLE;

    if (isMapbox && !props.mapboxApiKey) {
      return (
        <div
          style={{
            width,
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            textAlign: 'center',
            color: theme.colorTextSecondary,
          }}
        >
          {t(
            'Mapbox requires a MAPBOX_API_KEY to be configured on the server.',
          )}
        </div>
      );
    }

    if (isMapbox && props.mapboxApiKey) {
      mapboxgl.accessToken = props.mapboxApiKey;
    }

    return (
      <>
        <div
          style={{ position: 'relative', width, height }}
          onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {isMapbox ? (
            <MapboxMap
              {...viewState}
              onMove={onMove}
              mapStyle={mapStyle}
              style={{ width, height }}
            >
              <DeckGLOverlayMapbox layers={layers()} />
            </MapboxMap>
          ) : (
            <MapLibreMap
              {...viewState}
              onMove={onMove}
              mapStyle={mapStyle}
              style={{ width, height }}
            >
              <DeckGLOverlayMapLibre layers={layers()} />
            </MapLibreMap>
          )}
          {children}
        </div>
        {renderTooltip(tooltip)}
      </>
    );
  }),
);

export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
  .deckgl-tooltip > div {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export type DeckGLContainerHandle = typeof DeckGLContainer & {
  setTooltip: (tooltip: TooltipProps['tooltip']) => void;
};
