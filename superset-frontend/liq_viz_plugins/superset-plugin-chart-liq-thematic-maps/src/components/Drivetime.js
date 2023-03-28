import React, { useState } from 'react';
import { Button, Radio, Form, InputNumber, Typography } from 'antd';
import { refreshChart } from '../utils/overrides/chartActionOverride';
import { useDispatch } from 'react-redux';

const liqSecrets = require('../../../liq_secrets.js').liqSecrets;

const otherUtils = require('../utils/others.js');
const uuid = otherUtils.uuidv4;

export default function Drivetime(props) {
  
  const {
    boundary,
    groupCol,
    drivetimeColor,
    drivetimeThreshold,
    drivetimeLinkedCharts,
    map
  } = props;

  const [travelMode, setTravelMode] = useState('driving'); // type of travel mode for isochrone
  const [travelMetric, setTravelMetric] = useState('distance'); // whether metric provided is in meters or min
  const [val, setVal] = useState(0);
  const [message, setMessage] = useState(''); // user prompt
  const [id, setId] = useState(uuid());
  
  const dispatch = useDispatch();

  const refreshLinkedCharts = () => {
    const split = window.location.href.split('/');
    if (split[4] === 'dashboard') {
      const dashboardId = parseInt(split[5]);
      drivetimeLinkedCharts.forEach(chartKey =>
        dispatch(refreshChart(chartKey, true, dashboardId)),
      );
    }
  }

  // Remove drivetime geojson source and layer and delete drivetime key url param
  const removeDrivetime = () => {
    if ('drivetime' in map.current.getStyle().sources) {
      map.current.removeLayer('drivetime');
      map.current.removeLayer('drivetime_sa1s');
      map.current.removeSource('drivetime');
      const url = new URL(window.location.href);
      url.searchParams.delete('drivetime_key');
      window.history.replaceState(null, null, url);
      refreshLinkedCharts();
    }
  }

  // Add drivetime geojson source and layer and update drivetime key url param
  const drawDrivetime = (drivetime) => {
    map.current.addSource('drivetime', {
      'type': 'geojson',
      'data': drivetime
    });
    map.current.addLayer({
      'id': 'drivetime',
      'type': 'fill',
      'source': 'drivetime',
      'layout': {},
      'paint': {
        'fill-color': drivetimeColor,
      }
    });
    map.current.addLayer({
      'id': 'drivetime_sa1s',
      'type': 'line',
      'source': 'boundary_tileset',
      'source-layer': boundary,
      'paint': {
        'line-color': 'transparent',
      }
    });
    map.current.off('click', getDrivetime);
    setMessage('');
    addSA1s(drivetime);
    const url = new URL(window.location.href);
    url.searchParams.set('drivetime_key', id);
    window.history.pushState(null, null, url);
  }

  // query mapbox api for drivetime
  const getDrivetime = (e) => {
    const coords = [e.lngLat.lng, e.lngLat.lat];
    var requestOptions = {
      method: 'GET',
      redirect: 'follow'
    };
    const url = `https://api.mapbox.com/isochrone/v1/mapbox/${travelMode}/${coords[0]},${coords[1]}?`
      + `${travelMetric === 'distance' ? 'contours_meters=' : 'contours_minutes='}${val}&`
      + `polygons=true&access_token=${liqSecrets.mapbox.accessToken}`;
    fetch(url, requestOptions)
      .then(response => response.json())
      .then(result => drawDrivetime(result));
  }

  // Query lambda function to get constituent SA1s of drivetime and update map style to reflect
  const addSA1s = (drivetime) => {
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');

    var raw = {
      'secret': liqSecrets.lambdaFunctions.intersection.secret,
      'GeoJSON': drivetime,
      'threshold': drivetimeThreshold
    }

    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify(raw),
      redirect: 'follow'
    }

    fetch(liqSecrets.lambdaFunctions.intersection.url, requestOptions)
      .then(response => response.json())
      .then(result => {
        const boundaries = ['SA1_CODE21', 'SA2_CODE21', 'SA3_CODE21', 'SA4_CODE21', 'DZN_CODE21']
        const paint = [
          'case',
          ['in', ['get', boundaries.includes(groupCol) ? groupCol : 'SA1_CODE21'], ['literal', result.sa1s]],
          '#FFFFFF',
          'transparent'
        ]
        map.current.setPaintProperty('drivetime_sa1s', 'line-color', paint);
        postRkeySA1s(result.sa1s);
      })
  }

  // Post constituent SA1s and radius key to internal api
  const postRkeySA1s = (sa1s) => {
    var myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    var raw = JSON.stringify({
      'radius_key': id,
      'sa1s': sa1s
    });
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };
    fetch('http://localhost:8088/api/v1/liq/set_radius/', requestOptions)
      .then(() => {
        refreshLinkedCharts();
      });
  }

  const onSettingsSave = () => {
    removeDrivetime();
    map.current.on('click', getDrivetime);
    setMessage('Click anywhere on the map');    
  }

  return (
    <Form layout='vertical'>
      <Form.Item label='Travel mode'>
        <Radio.Group 
          value={travelMode} 
          onChange={(e) => setTravelMode(e.target.value)}
          buttonStyle='solid'
          size='medium'
      >
          <Radio.Button value='driving'>Drive</Radio.Button>
          <Radio.Button value='walking'>Cycle</Radio.Button>
          <Radio.Button value='cycling'>Walk</Radio.Button>
        </Radio.Group>
      </Form.Item>
      <Form.Item label='Travel metric'>
        <Radio.Group
          value={travelMetric}
          onChange={(e) => setTravelMetric(e.target.value)}
          buttonStyle='solid'
          size='medium'
        >
          <Radio.Button value='distance'>Distance</Radio.Button>
          <Radio.Button value='time'>Time</Radio.Button>
        </Radio.Group>
      </Form.Item>
      <Form.Item>
        <InputNumber 
          min={0}
          max={travelMetric === 'distance' ? 100000 : 60}
          addonAfter={travelMetric === 'distance' ? 'm' : 'min'}
          onChange={v => setVal(v)}
        />
      </Form.Item>
      <Form.Item>
          <Button type='primary' htmlType='submit' onClick={onSettingsSave}>
            OK
          </Button>
          {'     '}
          <Button type='dashed' onClick={removeDrivetime}>
            Clear
          </Button>
      </Form.Item>
      <Form.Item>
        <Typography>{message}</Typography>
      </Form.Item>
    </Form>
  );
}