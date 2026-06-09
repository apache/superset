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

export type MapProvider = 'maplibre' | 'mapbox';

export type MapRendererOption = {
  value: MapProvider;
  disabled?: boolean;
};

export type MapProviderMapStyle = {
  mapProvider?: unknown;
  maplibreStyle?: unknown;
  mapboxStyle?: unknown;
  legacyMapStyle?: unknown;
};

export type SelectedMapProviderMapStyle = {
  mapProvider: MapProvider;
  mapStyle?: string;
};

export type RasterTileMapStyle = {
  version: 8;
  sources: {
    [sourceId: string]: {
      type: 'raster';
      tiles: string[];
      tileSize: 256;
      attribution?: string;
    };
  };
  layers: [
    {
      id: string;
      type: 'raster';
      source: string;
      minzoom: 0;
      maxzoom: 22;
    },
  ];
};

export type ResolvedMapStyle = string | RasterTileMapStyle;

export const OSM_TILE_STYLE_URL =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_TILE_ATTRIBUTION = '© OpenStreetMap contributors';

export const MAPLIBRE_RENDERER_OPTION: MapRendererOption = {
  value: 'maplibre',
};
export const MAPBOX_RENDERER_OPTION: MapRendererOption = {
  value: 'mapbox',
};
export const DISABLED_MAPBOX_RENDERER_OPTION: MapRendererOption = {
  ...MAPBOX_RENDERER_OPTION,
  disabled: true,
};

const TILE_PROTOCOL = 'tile://';
const RASTER_SOURCE_ID = 'osm-raster-tiles';
const RASTER_LAYER_ID = 'osm-raster-layer';

type BootstrapData = {
  common?: {
    conf?: {
      DEFAULT_MAP_RENDERER?: unknown;
      MAPBOX_API_KEY?: unknown;
    };
  };
};

export function getBootstrapDataFromDocument(): unknown {
  if (typeof document === 'undefined') {
    return undefined;
  }

  try {
    const appContainer = document.getElementById('app');
    const dataBootstrap = appContainer?.getAttribute('data-bootstrap');
    return dataBootstrap ? JSON.parse(dataBootstrap) : undefined;
  } catch {
    return undefined;
  }
}

export function getMapboxApiKeyFromBootstrap(
  bootstrapData: unknown = getBootstrapDataFromDocument(),
): string {
  const mapboxApiKey = (bootstrapData as BootstrapData | undefined)?.common
    ?.conf?.MAPBOX_API_KEY;
  return typeof mapboxApiKey === 'string' ? mapboxApiKey.trim() : '';
}

export function hasMapboxApiKey(
  bootstrapData: unknown = getBootstrapDataFromDocument(),
): boolean {
  return getMapboxApiKeyFromBootstrap(bootstrapData).trim().length > 0;
}

export function getDefaultMapRenderer(
  bootstrapData: unknown = getBootstrapDataFromDocument(),
): MapProvider {
  const conf = (bootstrapData as BootstrapData | undefined)?.common?.conf;
  const defaultRenderer = conf?.DEFAULT_MAP_RENDERER;

  if (defaultRenderer === 'mapbox' && hasMapboxApiKey(bootstrapData)) {
    return 'mapbox';
  }

  return 'maplibre';
}

export function getMapRendererOptions({
  hasMapboxKey,
  currentValue,
}: {
  hasMapboxKey: boolean;
  currentValue?: MapProvider;
}): MapRendererOption[] {
  if (!hasMapboxKey && currentValue !== 'mapbox') {
    return [MAPLIBRE_RENDERER_OPTION];
  }

  return [
    MAPLIBRE_RENDERER_OPTION,
    hasMapboxKey ? MAPBOX_RENDERER_OPTION : DISABLED_MAPBOX_RENDERER_OPTION,
  ];
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function isMapboxStyle(value: unknown): boolean {
  return getNonEmptyString(value)?.startsWith('mapbox://') ?? false;
}

export function getMapProviderMapStyle({
  mapProvider,
  maplibreStyle,
  mapboxStyle,
  legacyMapStyle,
}: MapProviderMapStyle): SelectedMapProviderMapStyle {
  const selectedMapProvider: MapProvider =
    mapProvider === 'mapbox' ? 'mapbox' : 'maplibre';
  const maplibreStyleValue = getNonEmptyString(maplibreStyle);
  const mapboxStyleValue = getNonEmptyString(mapboxStyle);
  const legacyMapStyleValue = getNonEmptyString(legacyMapStyle);

  if (selectedMapProvider === 'mapbox') {
    return {
      mapProvider: selectedMapProvider,
      mapStyle: mapboxStyleValue ?? legacyMapStyleValue,
    };
  }

  return {
    mapProvider: selectedMapProvider,
    mapStyle:
      maplibreStyleValue ??
      (isMapboxStyle(mapboxStyleValue) ? undefined : mapboxStyleValue) ??
      legacyMapStyleValue,
  };
}

function unwrapTileProtocol(value: string): string {
  return value.startsWith(TILE_PROTOCOL)
    ? value.slice(TILE_PROTOCOL.length)
    : value;
}

export function isRasterTileTemplate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const tileUrl = unwrapTileProtocol(value);
  return ['{z}', '{x}', '{y}'].every(templateParam =>
    tileUrl.includes(templateParam),
  );
}

function isOpenStreetMapTileUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === 'openstreetmap.org' ||
      hostname.endsWith('.openstreetmap.org')
    );
  } catch {
    return false;
  }
}

export function buildRasterTileMapStyle(value: string): RasterTileMapStyle {
  const tileUrl = unwrapTileProtocol(value);
  const attribution = isOpenStreetMapTileUrl(tileUrl)
    ? { attribution: OSM_TILE_ATTRIBUTION }
    : {};

  return {
    version: 8,
    sources: {
      [RASTER_SOURCE_ID]: {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        ...attribution,
      },
    },
    layers: [
      {
        id: RASTER_LAYER_ID,
        type: 'raster',
        source: RASTER_SOURCE_ID,
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

export function resolveMapStyle(
  value: string | undefined,
  defaultStyle: string,
): ResolvedMapStyle {
  if (!value) {
    return defaultStyle;
  }

  return isRasterTileTemplate(value) ? buildRasterTileMapStyle(value) : value;
}
