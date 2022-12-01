import React from 'react';
import { IFrameVisualizationProps } from './types';


export default function IFrameVisualization(props: IFrameVisualizationProps) {
  const { url, url_parameter_value, parameter_name, parameter_prefix, errorMessage} = props
  
  const parserdUrlParameterName = parameter_name.includes('=') ? parameter_name : `${parameter_name}=${parameter_prefix}`

  return (
    <>
      { errorMessage ?
      <>{errorMessage}</> :
      <iframe src={`${url}?${parserdUrlParameterName}${url_parameter_value}`} style={{ position: 'absolute', left:0, top: '50px', width:'95%', height:'100%' }}></iframe> }
    </>
  );
}
