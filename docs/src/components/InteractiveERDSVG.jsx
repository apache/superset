import React from 'react';
import { UncontrolledReactSVGPanZoom } from 'react-svg-pan-zoom';
import ErdSvg from '../../static/img/erd.svg';

function InteractiveERDSVG() {
  return (
    <UncontrolledReactSVGPanZoom
      width="100%"
      height="800"
      background="#003153"
      tool="auto"
    >
      <svg>
        <ErdSvg />
      </svg>
    </UncontrolledReactSVGPanZoom>
  );
}

export default InteractiveERDSVG;
