import {getCompositeGLType} from '../webgl-utils/attribute-utils';

export function getDebugTableForProgramConfiguration(config) {
  const table = {};

  const header = `Accessors for ${config.id}`;

  for (const attributeInfo of config.attributeInfos) {
    if (attributeInfo) {
      const glslDeclaration = getGLSLDeclaration(attributeInfo);
      table[`in ${glslDeclaration}`] = {[header]: JSON.stringify(attributeInfo.accessor)};
    }
  }

  for (const varyingInfo of config.varyingInfos) {
    if (varyingInfo) {
      const glslDeclaration = getGLSLDeclaration(varyingInfo);
      table[`out ${glslDeclaration}`] = {[header]: JSON.stringify(varyingInfo.accessor)};
    }
  }

  return table;
}

function getGLSLDeclaration(attributeInfo) {
  const {type, size} = attributeInfo.accessor;
  const typeAndName = getCompositeGLType(type, size);
  if (typeAndName) {
    return `${typeAndName.name} ${attributeInfo.name}`;
  }
  return attributeInfo.name;
}
