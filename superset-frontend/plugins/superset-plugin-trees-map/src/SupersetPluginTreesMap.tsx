import { WebMercatorViewport } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import DeckGL from '@deck.gl/react';
import React, { useEffect, useState } from 'react';
import StaticMap from 'react-map-gl';
import { ColorCollection } from './colors';
import { Legend } from './components/Legend';
import { TreeToltip } from './components/TreeTooltip';
import { SupersetPluginTreesMapProps } from './types';

export default function SupersetPluginTreesMap(
  props: SupersetPluginTreesMapProps,
) {
  const { mapboxApiAccessKey, data, height, width } = props;

  const INITIAL_VIEW_STATE = {
    longitude: 13.39883104394256,
    latitude: 52.498574638202776,
    zoom: 13,
    pitch: 0,
    bearing: 0,
  };

  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [selectedObject, setSelectedObject] = useState<any>();
  const [hoveredObject, setHoveredObject] = useState<any>();

  useEffect(() => {
    setSelectedObject(undefined);
  }, [viewState]);

  useEffect(() => {
    const lats = data.map(xs => xs.lat as number);
    const lons = data.map(xs => xs.lng as number);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const { longitude, latitude, zoom } = new WebMercatorViewport(
      viewState,
    ).fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { minExtent: 0.05 },
    );

    setViewState({
      ...viewState,
      longitude,
      latitude,
      zoom,
    });
  }, [data]);

  const layers = [
    new ScatterplotLayer({
      id: 'scatterplot-layer',
      data,
      pickable: true,
      opacity: 1,
      stroked: false,
      filled: true,
      radiusMinPixels: 1,
      radiusMaxPixels: 100,
      lineWidthMinPixels: 1,
      getPosition: (d: any) => [d.lng, d.lat],
      getRadius: (d: any) => (hoveredObject === d.id ? 8 : 6),
      getFillColor: (data: any) => {
        let returnColor = ColorCollection.unknown.color;
        const nowcast = parseInt(data.nowcast_value, 10);
        if (nowcast && nowcast < 33) {
          const {
            good: { color },
          } = ColorCollection;
          returnColor = color;
        } else if (nowcast && nowcast < 81) {
          const {
            average: { color },
          } = ColorCollection;
          returnColor = color;
        } else {
          const {
            critical: { color },
          } = ColorCollection;
          returnColor = color;
        }
        return returnColor;
      },
      onClick: (info: any) => {
        setSelectedObject(info);
      },
      updateTriggers: {
        getLineWidth: [hoveredObject],
        getRadius: [hoveredObject],
      },
    }),
  ];

  const getTooltip = ({ object }: any) => {
    if (object?.id) {
      setHoveredObject(object.id);
    } else {
      setHoveredObject(undefined);
    }
    return null;
  };

  return (
    <>
      <div style={{ position: 'relative', width, height }}>
        <DeckGL
          initWebGLParameters
          controller
          width={width}
          height={height}
          layers={layers}
          viewState={viewState}
          glOptions={{ preserveDrawingBuffer: true }}
          onViewStateChange={({ viewState }: any) => {
            setViewState(viewState);
          }}
          getTooltip={getTooltip}
        >
          <StaticMap
            preserveDrawingBuffer
            mapboxApiAccessToken={mapboxApiAccessKey}
          />
        </DeckGL>
        <Legend />
        {selectedObject && (
          <TreeToltip
            selectedObject={selectedObject}
            setSelectedObject={setSelectedObject}
          />
        )}
      </div>
    </>
  );
}
