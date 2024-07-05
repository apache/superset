import {
  forwardRef,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { isEqual } from 'lodash';
import { StaticMap } from 'react-map-gl';
import DeckGL, { Layer } from 'deck.gl/typed';
import { JsonObject, JsonValue, styled, usePrevious } from '@superset-ui/core';
import { SearchBox } from '@mapbox/search-js-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'plugins/legacy-preset-chart-deckgl/customMapControl.css'; // Example custom styles, adjust as needed
import mapboxgl from 'mapbox-gl';
import { Viewport } from './utils/fitViewport';
import Tooltip, { TooltipProps } from './components/Tooltip';

const TICK = 250; // milliseconds

export type DeckGLContainerProps = {
  viewport: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  mapboxApiAccessToken: string;
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
    const [viewState, setViewState] = useState<Viewport>(props.viewport);
    const prevViewport = usePrevious(props.viewport);
    const searchBoxRef = useRef(null);
    const [inputValue, setInputValue] = useState('');

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

    const handleSearchResult = (result: any) => {
      console.log('Search result received:', result);
      if (result?.features && result.features.length > 0) {
        const [longitude, latitude] = result.features[0].geometry.coordinates;
        console.log('Updating view state with coordinates:', {
          longitude,
          latitude,
        });
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
            glOptions={{ preserveDrawingBuffer: true }}
            onViewStateChange={onViewStateChange}
          >
            <StaticMap
              preserveDrawingBuffer
              mapStyle={props.mapStyle || 'light'}
              mapboxApiAccessToken={props.mapboxApiAccessToken}
              {...viewState} // Spread the viewState directly to StaticMap
            />
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
  setTooltip: (tooltip: ReactNode) => void;
};
