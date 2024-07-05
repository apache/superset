// import {
//   forwardRef,
//   memo,
//   useCallback,
//   useEffect,
//   useImperativeHandle,
//   useRef,
//   useState,
// } from 'react';
// import { isEqual } from 'lodash';
// import { StaticMap, Marker } from 'react-map-gl';
// import DeckGL, { Layer } from 'deck.gl/typed';
// import { JsonObject, JsonValue, styled, usePrevious } from '@superset-ui/core';
// import { SearchBox } from '@mapbox/search-js-react';
// import 'mapbox-gl/dist/mapbox-gl.css';
// import 'plugins/legacy-preset-chart-deckgl/customMapControl.css'; // Example custom styles, adjust as needed
// import mapboxgl from 'mapbox-gl';
// import RainLayer from 'mapbox-gl-rain-layer';
// import { Viewport } from './utils/fitViewport';
// import Tooltip, { TooltipProps } from './components/Tooltip';

// const TICK = 250; // milliseconds

// export type DeckGLContainerProps = {
//   viewport: Viewport;
//   setControlValue?: (control: string, value: JsonValue) => void;
//   mapStyle?: string;
//   mapboxApiAccessToken: string;
//   children?: React.ReactNode;
//   width: number;
//   height: number;
//   layers: (Layer | (() => Layer))[];
//   onViewportChange?: (viewport: Viewport) => void;
// };

// export const DeckGLContainer = memo(
//   forwardRef((props: DeckGLContainerProps, ref) => {
//     const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
//     const [lastUpdate, setLastUpdate] = useState<number | null>(null);
//     const [viewState, setViewState] = useState<Viewport>(props.viewport);
//     const [markerPosition, setMarkerPosition] = useState<
//       [number, number] | null
//     >(null);
//     const prevViewport = usePrevious(props.viewport);
//     const searchBoxRef = useRef<any>(null);
//     const [inputValue, setInputValue] = useState('');
//     const mapRef = useRef<mapboxgl.Map | null>(null);
//     useImperativeHandle(ref, () => ({ setTooltip }), []);

//     const tick = useCallback(() => {
//       if (lastUpdate && Date.now() - lastUpdate > TICK) {
//         const setCV = props.setControlValue;
//         if (setCV) {
//           setCV('viewport', viewState);
//         }
//         setLastUpdate(null);
//       }
//     }, [lastUpdate, props.setControlValue, viewState]);

//     useEffect(() => {
//       const timer = setInterval(tick, TICK);
//       return () => clearInterval(timer);
//     }, [tick]);

//     useEffect(() => {
//       if (!isEqual(props.viewport, prevViewport)) {
//         setViewState(props.viewport);
//       }
//     }, [prevViewport, props.viewport]);

//     const onViewStateChange = useCallback(
//       ({ viewState }: { viewState: JsonObject }) => {
//         setViewState(viewState as Viewport);
//         setLastUpdate(Date.now());
//         if (props.onViewportChange) {
//           props.onViewportChange(viewState as Viewport);
//         }
//       },
//       [props],
//     );

//     const layers = useCallback(() => {
//       if (props.layers.some(l => typeof l === 'function')) {
//         return props.layers.map(l =>
//           typeof l === 'function' ? l() : l,
//         ) as Layer[];
//       }

//       return props.layers as Layer[];
//     }, [props.layers]);

//     const initializeLayers = useCallback(() => {
//       if (!mapRef.current) return;

//       const map = mapRef.current;
//       console.log('Initializing layers');

//       const rainLayer = new RainLayer({
//         id: 'rain-layer',
//         source: 'rainviewer',
//         scale: 'noaa',
//       });

//       map.addLayer(rainLayer);
//       console.log('Rain layer added');

//       const coordinates = [
//         [-80.425, 46.437], // [west, north]
//         [-71.516, 46.437], // [east, north]
//         [-71.516, 37.936], // [east, south]
//         [-80.425, 37.936], // [west, south]
//       ];

//       map.addSource('image-source', {
//         type: 'image',
//         url: 'https://www.mapbox.com/mapbox-gl-js/assets/radar.gif',
//         coordinates: coordinates,
//       });
//       console.log('Image source added');

//       map.addLayer({
//         id: 'image-layer',
//         source: 'image-source',
//         type: 'raster',
//         paint: {
//           'raster-opacity': 0.85,
//         },
//       });
//       console.log('Image layer added');
//     }, []);

//     useEffect(() => {
//       const checkMapAvailability = () => {
//         const map = mapRef.current;
//         if (map && map.isStyleLoaded()) {
//           console.log('Map is available');
//           initializeLayers();
//         } else {
//           console.log('Map is not available, retrying...');
//           setTimeout(checkMapAvailability, 500); // Retry after 500ms
//         }
//       };

//       checkMapAvailability();
//     }, [initializeLayers]);

//     const handleSearchResult = (result: any) => {
//       console.log('Search result received:', result);
//       if (result?.features && result.features.length > 0) {
//         const [longitude, latitude] = result.features[0].geometry.coordinates;
//         console.log('Updating view state with coordinates:', {
//           longitude,
//           latitude,
//         });
//         setMarkerPosition([longitude, latitude]);
//         setViewState(prevState => ({
//           ...prevState,
//           longitude,
//           latitude,
//           zoom: 12,
//         }));
//       }
//     };

//     useEffect(() => {
//       console.log('Updated viewState:', viewState);
//     }, [viewState]);

//     const { children = null, height, width } = props;

//     return (
//       <>
//         <div style={{ position: 'relative', width, height }}>
//           <DeckGL
//             controller
//             width={width}
//             height={height}
//             layers={layers()}
//             viewState={viewState}
//             onViewStateChange={onViewStateChange}
//           >
//             <StaticMap
//               mapStyle={props.mapStyle || 'mapbox://styles/mapbox/streets-v11'}
//               mapboxApiAccessToken={props.mapboxApiAccessToken}
//               {...viewState} // Spread the viewState directly to StaticMap
//               ref={(instance) => {
//                 if (instance) {
//                   mapRef.current = instance.getMap();
//                 }
//               }}
//             >
//               {markerPosition && (
//                 <Marker
//                   longitude={markerPosition[0]}
//                   latitude={markerPosition[1]}
//                 >
//                   <div
//                     style={{
//                       width: '24px',
//                       height: '24px',
//                       borderRadius: '50%',
//                       backgroundColor: '#1978c8',
//                       border: '2px solid #fff',
//                       cursor: 'pointer',
//                     }}
//                   />
//                 </Marker>
//               )}
//             </StaticMap>
//             <SearchBox
//               accessToken={props.mapboxApiAccessToken}
//               onRetrieve={handleSearchResult}
//               mapboxgl={mapboxgl}
//               ref={searchBoxRef}
//               value={inputValue}
//               onChange={(value: string) => setInputValue(value)}
//               marker
//             />
//           </DeckGL>
//           {children}
//         </div>
//         <Tooltip tooltip={tooltip} />
//       </>
//     );
//   }),
// );

// export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
//   .deckgl-tooltip > div {
//     overflow: hidden;
//     text-overflow: ellipsis;
//   }
// `;

// export type DeckGLContainerHandle = typeof DeckGLContainer & {
//   setTooltip: (tooltip: React.ReactNode) => void;
// };

// import {
//   forwardRef,
//   memo,
//   useCallback,
//   useEffect,
//   useImperativeHandle,
//   useRef,
//   useState,
// } from 'react';
// import { isEqual } from 'lodash';
// import { StaticMap, Marker } from 'react-map-gl';
// import DeckGL, { Layer } from 'deck.gl/typed';
// import { JsonObject, JsonValue, styled, usePrevious } from '@superset-ui/core';
// import { SearchBox } from '@mapbox/search-js-react';
// import 'mapbox-gl/dist/mapbox-gl.css';
// import 'plugins/legacy-preset-chart-deckgl/customMapControl.css'; // Example custom styles, adjust as needed
// import mapboxgl from 'mapbox-gl';
// import RainLayer from 'mapbox-gl-rain-layer';
// import { Viewport } from './utils/fitViewport';
// import Tooltip, { TooltipProps } from './components/Tooltip';

// const TICK = 250; // milliseconds

// export type DeckGLContainerProps = {
//   viewport: Viewport;
//   setControlValue?: (control: string, value: JsonValue) => void;
//   mapStyle?: string;
//   mapboxApiAccessToken: string;
//   children?: React.ReactNode;
//   width: number;
//   height: number;
//   layers: (Layer | (() => Layer))[];
//   onViewportChange?: (viewport: Viewport) => void;
// };

// export const DeckGLContainer = memo(
//   forwardRef((props: DeckGLContainerProps, ref) => {
//     const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
//     const [lastUpdate, setLastUpdate] = useState<number | null>(null);
//     const [viewState, setViewState] = useState<Viewport>(props.viewport);
//     const [markerPosition, setMarkerPosition] = useState<
//       [number, number] | null
//     >(null);
//     const prevViewport = usePrevious(props.viewport);
//     const searchBoxRef = useRef<any>(null);
//     const [inputValue, setInputValue] = useState('');
//     const mapRef = useRef<mapboxgl.Map | null>(null);
//     useImperativeHandle(ref, () => ({ setTooltip }), []);

//     const tick = useCallback(() => {
//       if (lastUpdate && Date.now() - lastUpdate > TICK) {
//         const setCV = props.setControlValue;
//         if (setCV) {
//           setCV('viewport', viewState);
//         }
//         setLastUpdate(null);
//       }
//     }, [lastUpdate, props.setControlValue, viewState]);

//     useEffect(() => {
//       const timer = setInterval(tick, TICK);
//       return () => clearInterval(timer);
//     }, [tick]);

//     useEffect(() => {
//       if (!isEqual(props.viewport, prevViewport)) {
//         setViewState(props.viewport);
//       }
//     }, [prevViewport, props.viewport]);

//     const onViewStateChange = useCallback(
//       ({ viewState }: { viewState: JsonObject }) => {
//         setViewState(viewState as Viewport);
//         setLastUpdate(Date.now());
//         if (props.onViewportChange) {
//           props.onViewportChange(viewState as Viewport);
//         }
//       },
//       [props],
//     );

//     const layers = useCallback(() => {
//       if (props.layers.some(l => typeof l === 'function')) {
//         return props.layers.map(l =>
//           typeof l === 'function' ? l() : l,
//         ) as Layer[];
//       }

//       return props.layers as Layer[];
//     }, [props.layers]);

//     const initializeLayers = useCallback(() => {
//       if (!mapRef.current) return;

//       const map = mapRef.current;
//       console.log('Initializing layers');
// // Add the rain layer
//       // if (!map.getLayer('rain-layer')) {
//         const rainLayer = new RainLayer({
//           id: 'rain-layer',
//           source: 'rainviewer',
//           scale: 'noaa',
//         });

//         map.addLayer(rainLayer);
//         console.log('Rain layer added');
//       // }
//       // Add the image source
//       const coordinates = [
//         [-80.425, 46.437], // [west, north]
//         [-71.516, 46.437], // [east, north]
//         [-71.516, 37.936], // [east, south]
//         [-80.425, 37.936], // [west, south]
//       ];

//       // if (!map.getSource('image-source')) {
//         map.addSource('image-source', {
//           type: 'image',
//           url: 'https://www.mapbox.com/mapbox-gl-js/assets/radar.gif',
//           coordinates: coordinates,
//         });
//         console.log('Image source added');
//       // }

//       // if (!map.getLayer('image-layer')) {
//         map.addLayer({
//           id: 'image-layer',
//           source: 'image-source',
//           type: 'raster',
//           paint: {
//             'raster-opacity': 0.85,
//           },
//         });
//         console.log('Image layer added');
//       // }

//       // Add weather icons
//       const loadIcon = (iconName: string, iconUrl: string) => {
//         map.loadImage(iconUrl, (error, image) => {
//           if (error) {
//             console.error(`Error loading image ${iconUrl}:`, error);
//             return;
//           }
//           if (image && !map.hasImage(iconName)) {
//             map.addImage(iconName, image);
//           }
//         });
//       };

//       loadIcon('cloudy-icon', '/static/assets/images/thunder.gif');
//       loadIcon('location-icon', '/static/assets/images/location.png');
//       loadIcon('rainy-icon', '/static/assets/images/rainy.gif');
//       loadIcon('hot-icon', '/static/assets/images/sun.gif');

//       const weatherData = [
//         { coordinates: [-80.425, 46.437], icon: 'cloudy-icon' },
//         { coordinates: [-80.425, 46.437], icon: 'location-icon' },
//         { coordinates: [-75.516, 42.437], icon: 'rainy-icon' },
//         { coordinates: [-70.516, 39.936], icon: 'hot-icon' },
//       ];

//       weatherData.forEach(data => {
//         if (!map.getSource(`${data.icon}-source`)) {
//           map.addSource(`${data.icon}-source`, {
//             type: 'geojson',
//             data: {
//               type: 'FeatureCollection',
//               features: [
//                 {
//                   type: 'Feature',
//                   geometry: {
//                     type: 'Point',
//                     coordinates: data.coordinates,
//                   },
//                   properties: null
//                 },
//               ],
//             },
//           });
//         }

//         if (!map.getLayer(`${data.icon}-layer`)) {
//           map.addLayer({
//             id: `${data.icon}-layer`,
//             type: 'symbol',
//             source: `${data.icon}-source`,
//             layout: {
//               'icon-image': data.icon,
//               'icon-size': 0.1,
//             },
//           });
//         }
//       });

//       console.log('Weather icons added');
//     }, []);

//     useEffect(() => {
//             const checkMapAvailability = () => {
//               const map = mapRef.current;
//               if (map && map.isStyleLoaded()) {
//                 console.log('Map is available');
//                 initializeLayers();
//               } else {
//                 console.log('Map is not available, retrying...');
//                 setTimeout(checkMapAvailability, 500); // Retry after 500ms
//               }
//             };

//             checkMapAvailability();
//           }, [initializeLayers]);

//     const handleSearchResult = (result: any) => {
//       console.log('Search result received:', result);
//       if (result?.features && result.features.length > 0) {
//         const [longitude, latitude] = result.features[0].geometry.coordinates;
//         console.log('Updating view state with coordinates:', {
//           longitude,
//           latitude,
//         });
//         setMarkerPosition([longitude, latitude]);
//         setViewState(prevState => ({
//           ...prevState,
//           longitude,
//           latitude,
//           zoom: 12,
//         }));
//       }
//     };

//     useEffect(() => {
//       console.log('Updated viewState:', viewState);
//     }, [viewState]);

//     const { children = null, height, width } = props;

//     return (
//       <>
//         <div style={{ position: 'relative', width, height }}>
//           <DeckGL
//             controller
//             width={width}
//             height={height}
//             layers={layers()}
//             viewState={viewState}
//             onViewStateChange={onViewStateChange}
//           >
//             <StaticMap
//               mapStyle={props.mapStyle || 'mapbox://styles/mapbox/streets-v11'}
//               mapboxApiAccessToken={props.mapboxApiAccessToken}
//               {...viewState} // Spread the viewState directly to StaticMap
//               ref={(instance) => {
//                 if (instance) {
//                   mapRef.current = instance.getMap();
//                 }
//               }}
//             >
//               {markerPosition && (
//                 <Marker
//                   longitude={markerPosition[0]}
//                   latitude={markerPosition[1]}
//                 >
//                   <div
//                     style={{
//                       width: '24px',
//                       height: '24px',
//                       borderRadius: '50%',
//                       backgroundColor: '#1978c8',
//                       border: '2px solid #fff',
//                       cursor: 'pointer',
//                     }}
//                   />
//                   <img src="/static/assets/images/location.png"
//                   alt="you are here"
//                   height="14px"
//                   width="17px"/>

//                 </Marker>
//               )}
//             </StaticMap>
//             <SearchBox
//               accessToken={props.mapboxApiAccessToken}
//               onRetrieve={handleSearchResult}
//               mapboxgl={mapboxgl}
//               ref={searchBoxRef}
//               value={inputValue}
//               onChange={(value: string) => setInputValue(value)}
//               marker
//             />
//           </DeckGL>
//           {children}
//         </div>
//         <Tooltip tooltip={tooltip} />
//       </>
//     );
//   }),
// );

// export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
//   .deckgl-tooltip > div {
//     overflow: hidden;
//     text-overflow: ellipsis;
//   }
// `;

// export type DeckGLContainerHandle = typeof DeckGLContainer & {
//   setTooltip: (tooltip: React.ReactNode) => void;
// };

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { isEqual } from 'lodash';
import { StaticMap, Marker } from 'react-map-gl';
import DeckGL, { Layer } from 'deck.gl/typed';
import { JsonObject, JsonValue, styled, usePrevious } from '@superset-ui/core';
import { SearchBox } from '@mapbox/search-js-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'plugins/legacy-preset-chart-deckgl/customMapControl.css'; // Example custom styles, adjust as needed
import mapboxgl from 'mapbox-gl';
// import RainLayer from 'mapbox-gl-rain-layer';
import { Viewport } from './utils/fitViewport';
import Tooltip, { TooltipProps } from './components/Tooltip';

const TICK = 250; // milliseconds

export type DeckGLContainerProps = {
  viewport: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  mapboxApiAccessToken: string;
  children?: React.ReactNode;
  width: number;
  height: number;
  layers: (Layer | (() => Layer))[];
  onViewportChange?: (viewport: Viewport) => void;
};

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [viewState, setViewState] = useState<Viewport>(props.viewport);
    const [markerPosition, setMarkerPosition] = useState<
      [number, number] | null
    >(null);
    const prevViewport = usePrevious(props.viewport);
    const searchBoxRef = useRef<any>(null);
    const [inputValue, setInputValue] = useState('');
    const mapRef = useRef<mapboxgl.Map | null>(null);
    useImperativeHandle(ref, () => ({ setTooltip }), []);

    const tick = useCallback(() => {
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

    const onViewStateChange = useCallback(
      ({ viewState }: { viewState: JsonObject }) => {
        setViewState(viewState as Viewport);
        setLastUpdate(Date.now());
        if (props.onViewportChange) {
          props.onViewportChange(viewState as Viewport);
        }
      },
      [props],
    );

    const layers = useCallback(() => {
      if (props.layers.some(l => typeof l === 'function')) {
        return props.layers.map(l =>
          typeof l === 'function' ? l() : l,
        ) as Layer[];
      }

      return props.layers as Layer[];
    }, [props.layers]);

    const initializeLayers = useCallback(() => {
      if (!mapRef.current) return;

      const map = mapRef.current;
      console.log('Initializing layers');
      // Add the rain layer
      //  if (!map.getLayer('rain-layer')) {
      // const rainLayer = new RainLayer({
      //   id: 'rain-layer',
      //   source: 'rainviewer',
      //   scale: 'noaa',
      // });

      // map.addLayer(rainLayer);
      // console.log('Rain layer added');
      // }
      // Add the image source
      const coordinates = [
        [-80.425, 46.437], // [west, north]
        [-71.516, 46.437], // [east, north]
        [-71.516, 37.936], // [east, south]
        [-80.425, 37.936], // [west, south]
      ];

      // if (!map.getSource('image-source')) {
      map.addSource('image-source', {
        type: 'image',
        url: 'https://www.mapbox.com/mapbox-gl-js/assets/radar.gif',
        coordinates,
      });
      console.log('Image source added');
      // }

      // if (!map.getLayer('image-layer')) {
      map.addLayer({
        id: 'image-layer',
        source: 'image-source',
        type: 'raster',
        paint: {
          'raster-opacity': 0.85,
        },
      });
      console.log('Image layer added');
      // }

      // Add weather GIF icons
      const createGifMarker = (url: string, coordinates: [number, number]) => {
        const el = document.createElement('div');
        el.style.backgroundImage = `url(${url})`;
        el.style.width = '50px';
        el.style.height = '50px';
        el.style.backgroundSize = 'contain';

        new mapboxgl.Marker(el).setLngLat(coordinates).addTo(map);
      };

      createGifMarker('/static/assets/images/thunder.gif', [-40.425, 46.437]);
      createGifMarker('/static/assets/images/rainy.gif', [-65.516, 42.437]);
      createGifMarker('/static/assets/images/sun.gif', [-90.516, 39.936]);
      createGifMarker('/static/assets/images/rainy.gif', [-25.516, 14.437]);

      console.log('Weather GIF icons added');
    }, []);

    useEffect(() => {
      const checkMapAvailability = () => {
        const map = mapRef.current;
        if (map?.isStyleLoaded()) {
          console.log('Map is available');
          initializeLayers();
        } else {
          console.log('Map is not available, retrying...');
          setTimeout(checkMapAvailability, 500); // Retry after 500ms
        }
      };

      checkMapAvailability();
    }, [initializeLayers]);

    const handleSearchResult = (result: any) => {
      console.log('Search result received:', result);
      if (result?.features && result.features.length > 0) {
        const [longitude, latitude] = result.features[0].geometry.coordinates;
        console.log('Updating view state with coordinates:', {
          longitude,
          latitude,
        });
        setMarkerPosition([longitude, latitude]);
        setViewState(prevState => ({
          ...prevState,
          longitude,
          latitude,
          zoom: 12,
        }));
      }
    };

    useEffect(() => {
      console.log('Updated viewState:', viewState);
    }, [viewState]);

    const { children = null, height, width } = props;

    return (
      <>
        <div style={{ position: 'relative', width, height }}>
          <DeckGL
            controller
            width={width}
            height={height}
            layers={layers()}
            viewState={viewState}
            onViewStateChange={onViewStateChange}
          >
            <StaticMap
              mapStyle={props.mapStyle || 'mapbox://styles/mapbox/streets-v11'}
              mapboxApiAccessToken={props.mapboxApiAccessToken}
              {...viewState} // Spread the viewState directly to StaticMap
              ref={instance => {
                if (instance) {
                  mapRef.current = instance.getMap();
                }
              }}
            >
              {markerPosition && (
                <Marker
                  longitude={markerPosition[0]}
                  latitude={markerPosition[1]}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      // eslint-disable-next-line theme-colors/no-literal-colors
                      backgroundColor: '#1978c8',
                      // eslint-disable-next-line theme-colors/no-literal-colors
                      border: '2px solid #fff',
                      cursor: 'pointer',
                    }}
                  />
                </Marker>
              )}
            </StaticMap>
            <SearchBox
              accessToken={props.mapboxApiAccessToken}
              onRetrieve={handleSearchResult}
              mapboxgl={mapboxgl}
              ref={searchBoxRef}
              value={inputValue}
              onChange={(value: string) => setInputValue(value)}
              marker
            />
          </DeckGL>
          {children}
        </div>
        <Tooltip tooltip={tooltip} />
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
  setTooltip: (tooltip: React.ReactNode) => void;
};
