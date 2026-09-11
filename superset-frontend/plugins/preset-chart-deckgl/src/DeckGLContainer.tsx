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
  useMemo,
  useState,
  isValidElement,
} from 'react';
import { isEqual } from 'lodash-es';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import { Map as MapboxMap } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import type { Layer } from '@deck.gl/core';
import { JsonObject, JsonValue } from '@superset-ui/core';
import {
  resolveMapStyle,
  type MapProvider,
  type ResolvedMapStyle,
} from '@superset-ui/core/utils/mapStyles';
import {
  hasFatalMapResourceError,
  hasUnrecoveredMapResourceError,
  type MapResourceEvent,
  type MapResourceState,
  recordMapResourceError,
  recordMapResourceSuccess,
} from '@superset-ui/core/utils/mapRenderStatus';
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
  mapProvider?: MapProvider;
  mapboxApiKey?: string;
  children?: ReactNode;
  width: number;
  height: number;
  layers: (Layer | (() => Layer))[];
  isLoading?: boolean;
  onViewportChange?: (viewport: Viewport) => void;
};

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [completedMapRender, setCompletedMapRender] = useState<object | null>(
      null,
    );
    const [completedDeckRender, setCompletedDeckRender] = useState<
      object | null
    >(null);
    const [mapResourceState, setMapResourceState] =
      useState<MapResourceState | null>(null);
    const [failedDeckRender, setFailedDeckRender] = useState<object | null>(
      null,
    );
    const [viewState, setViewState] = useState(props.viewport);

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
      setViewState(current =>
        isEqual(current, props.viewport) ? current : props.viewport,
      );
    }, [props.viewport]);

    const onMove = useCallback((evt: { viewState: JsonObject }) => {
      setViewState(evt.viewState as Viewport);
      setLastUpdate(Date.now());
    }, []);

    const isMapbox = props.mapProvider === 'mapbox';
    const canRenderMap = !isMapbox || Boolean(props.mapboxApiKey);
    const mapStyle = useMemo<ResolvedMapStyle>(
      () =>
        isMapbox
          ? props.mapStyle || DEFAULT_MAP_STYLE
          : resolveMapStyle(props.mapStyle, DEFAULT_MAP_STYLE),
      [isMapbox, props.mapStyle],
    );
    const currentMapSource = useMemo(
      () => ({
        hasMapboxApiKey: Boolean(props.mapboxApiKey),
        mapProvider: props.mapProvider,
        mapStyle,
      }),
      [mapStyle, props.mapProvider, props.mapboxApiKey],
    );
    const currentMapRender = useMemo(
      () => ({
        height: props.height,
        source: currentMapSource,
        viewState,
        width: props.width,
      }),
      [currentMapSource, props.height, props.width, viewState],
    );
    const resolvedLayers = useMemo(
      () =>
        canRenderMap
          ? (props.layers.map(layer =>
              typeof layer === 'function' ? layer() : layer,
            ) as Layer[])
          : [],
      [canRenderMap, props.layers],
    );
    const currentDeckRender = useMemo(
      () => ({
        ...currentMapRender,
        layers: resolvedLayers,
      }),
      [currentMapRender, resolvedLayers],
    );
    const currentDeckSource = useMemo(
      () => ({
        layers: resolvedLayers,
        mapSource: currentMapSource,
      }),
      [currentMapSource, resolvedLayers],
    );
    const onMapIdle = useCallback(
      () => setCompletedMapRender(currentMapRender),
      [currentMapRender],
    );
    const onMapData = useCallback(
      (event: MapResourceEvent) => {
        setMapResourceState(current =>
          recordMapResourceSuccess(current, currentMapSource, event),
        );
      },
      [currentMapSource],
    );
    const onMapError = useCallback(
      (event: MapResourceEvent) => {
        // Require a fresh idle after any resource error. A source with at
        // least one successful tile may still produce a useful partial map;
        // a wholly failed source is terminal once the map becomes idle.
        setCompletedMapRender(null);
        setMapResourceState(current =>
          recordMapResourceError(current, currentMapSource, event),
        );
      },
      [currentMapSource],
    );
    const onDeckAfterRender = useCallback(
      () => setCompletedDeckRender(currentDeckRender),
      [currentDeckRender],
    );
    const onDeckError = useCallback(
      (error: Error) => {
        console.error('DeckGL rendering failed', error);
        setFailedDeckRender(currentDeckSource);
      },
      [currentDeckSource],
    );
    const mapResourceFailed =
      hasFatalMapResourceError(mapResourceState, currentMapSource) ||
      (completedMapRender === currentMapRender &&
        hasUnrecoveredMapResourceError(mapResourceState, currentMapSource));
    const deckRenderFailed = failedDeckRender === currentDeckSource;
    const mapRenderComplete =
      !props.isLoading &&
      !mapResourceFailed &&
      !deckRenderFailed &&
      completedMapRender === currentMapRender &&
      completedDeckRender === currentDeckRender;

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

    if (isMapbox && !props.mapboxApiKey) {
      return (
        <div
          data-superset-map-status="error"
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
          data-superset-map-status={
            mapResourceFailed || deckRenderFailed
              ? 'error'
              : mapRenderComplete
                ? 'rendered'
                : 'loading'
          }
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
              onIdle={onMapIdle}
              onError={onMapError}
              onData={onMapData}
              mapStyle={mapStyle}
              style={{ width, height }}
            >
              <DeckGLOverlayMapbox
                layers={resolvedLayers}
                onAfterRender={onDeckAfterRender}
                onError={onDeckError}
              />
            </MapboxMap>
          ) : (
            <MapLibreMap
              {...viewState}
              onMove={onMove}
              onIdle={onMapIdle}
              onError={onMapError}
              onData={onMapData}
              mapStyle={mapStyle}
              style={{ width, height }}
            >
              <DeckGLOverlayMapLibre
                layers={resolvedLayers}
                onAfterRender={onDeckAfterRender}
                onError={onDeckError}
              />
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
