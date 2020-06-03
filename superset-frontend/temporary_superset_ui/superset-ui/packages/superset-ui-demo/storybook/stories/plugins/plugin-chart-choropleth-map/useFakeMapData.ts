import { useState, useEffect } from 'react';
import generateFakeMapData, { FakeMapData } from './generateFakeMapData';

export default function useFakeMapData(map: string) {
  const [mapData, setMapData] = useState<FakeMapData | undefined>(undefined);

  useEffect(() => {
    generateFakeMapData(map).then(mapData => {
      setMapData(mapData);
    });
  }, [map]);

  return mapData;
}
