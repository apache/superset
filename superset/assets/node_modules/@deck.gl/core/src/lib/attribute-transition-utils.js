import {Buffer} from 'luma.gl';
import {fillArray} from '../utils/flatten';

const ATTRIBUTE_MAPPING = {
  1: 'float',
  2: 'vec2',
  3: 'vec3',
  4: 'vec4'
};

export function getShaders(transitions) {
  // Build shaders
  const varyings = [];
  const attributeDeclarations = [];
  const uniformsDeclarations = [];
  const varyingDeclarations = [];
  const calculations = [];

  for (const attributeName in transitions) {
    const transition = transitions[attributeName];
    const attributeType = ATTRIBUTE_MAPPING[transition.attribute.size];

    if (attributeType) {
      transition.bufferIndex = varyings.length;
      varyings.push(attributeName);

      attributeDeclarations.push(`attribute ${attributeType} ${attributeName}From;`);
      attributeDeclarations.push(`attribute ${attributeType} ${attributeName}To;`);
      uniformsDeclarations.push(`uniform float ${attributeName}Time;`);
      varyingDeclarations.push(`varying ${attributeType} ${attributeName};`);
      calculations.push(`${attributeName} = mix(${attributeName}From, ${attributeName}To,
        ${attributeName}Time);`);
    }
  }

  const vs = `
#define SHADER_NAME feedback-vertex-shader
${attributeDeclarations.join('\n')}
${uniformsDeclarations.join('\n')}
${varyingDeclarations.join('\n')}

void main(void) {
  ${calculations.join('\n')}
  gl_Position = vec4(0.0);
}
`;

  const fs = `\
#define SHADER_NAME feedback-fragment-shader

#ifdef GL_ES
precision highp float;
#endif

${varyingDeclarations.join('\n')}

void main(void) {
  gl_FragColor = vec4(0.0);
}
`;
  return {vs, fs, varyings};
}

export function getBuffers(transitions) {
  const sourceBuffers = {};
  const destinationBuffers = {};
  for (const attributeName in transitions) {
    const {fromState, toState, buffer} = transitions[attributeName];
    sourceBuffers[`${attributeName}From`] = fromState;
    sourceBuffers[`${attributeName}To`] = toState;
    destinationBuffers[`${attributeName}`] = buffer;
  }
  return {sourceBuffers, destinationBuffers};
}

export function padBuffer({fromState, toState, fromLength, toLength}) {
  // check if buffer needs to be padded
  if (fromLength >= toLength || !(fromState instanceof Buffer)) {
    return;
  }

  const data = new Float32Array(toLength);
  // copy the currect values
  data.set(fromState.getData({}));

  if (toState.isGeneric) {
    fillArray({
      target: data,
      source: toState.value,
      start: fromLength,
      count: (toLength - fromLength) / toState.size
    });
  } else {
    data.set(toState.buffer.data.subarray(fromLength), fromLength);
  }

  fromState.setData({data});
}
