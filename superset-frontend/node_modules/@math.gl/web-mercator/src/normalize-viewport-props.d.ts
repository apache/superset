/** Description of viewport */
type ViewportProps = {
  width: number;
  height: number;
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
};

/**
 * Apply mathematical constraints to viewport props
 * @param props
 */
export default function normalizeViewportProps(props: ViewportProps): ViewportProps;
