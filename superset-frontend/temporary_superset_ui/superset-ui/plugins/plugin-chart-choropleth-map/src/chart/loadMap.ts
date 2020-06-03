import { mapsLookup } from '../maps';
import MapMetadata from './MapMetadata';

export default function loadMap(key: string) {
  if (key in mapsLookup) {
    const metadata = new MapMetadata(mapsLookup[key]);
    return metadata.loadMap().then(object => ({ metadata, object }));
  }

  return Promise.reject(new Error(`Unknown map: ${key}`));
}
