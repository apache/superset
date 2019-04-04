/* eslint quotes: ["error", "single", { "allowTemplateLiterals": true }]*/
// A scenegraph object node
import GL from '../constants';
import {Attribute, Buffer, Program, checkUniformValues} from '../webgl';
import Query from '../webgl/query';
import {isWebGL} from '../webgl-utils';
import {getUniformsTable, areUniformsEqual} from '../webgl/uniforms';
import {getDrawMode} from '../geometry/geometry';
import Object3D from '../core/object-3d';
import {MODULAR_SHADERS} from '../shadertools/shaders';
import {assembleShaders} from '../shadertools';
import {addModel, removeModel, logModel, getOverrides} from '../debug/seer-integration';
import {log, formatValue, isObjectEmpty} from '../utils';
import assert from '../utils/assert';

const MSG_INSTANCED_PARAM_DEPRECATED = `\
Warning: Model constructor: parameter "instanced" renamed to "isInstanced".
This will become a hard error in a future version of luma.gl.`;

const ERR_MODEL_PARAMS = 'Model needs drawMode and vertexCount';

const LOG_DRAW_PRIORITY = 2;

// These old picking uniforms should be avoided and we should use picking module
// and set uniforms using Model class 'updateModuleSettings()'
const DEPRECATED_PICKING_UNIFORMS = ['renderPickingBuffer', 'pickingEnabled'];

// Model abstract O3D Class
export default class Model extends Object3D {
  constructor(gl, opts = {}) {
    super(opts);
    assert(isWebGL(gl));
    this.gl = gl;
    this.init(opts);
  }

  /* eslint-disable max-statements  */
  /* eslint-disable complexity  */
  init({
    vs = null,
    fs = null,

    // 1: Modular shaders
    modules = null,
    defines = {},
    moduleSettings = {},

    // 2: Legacy shaders
    defaultUniforms,

    // 3: Pre-created program
    program = null,

    shaderCache = null,

    isInstanced = false, // Enables instanced rendering
    instanced, // deprecated
    vertexCount = undefined,
    instanceCount = 0,

    // Extra uniforms and attributes (beyond geometry, material, camera)
    drawMode,
    uniforms = {},
    attributes = {},
    geometry = null,

    // Picking
    pickable = true,
    pick = null,
    render = null,
    onBeforeRender = () => {},
    onAfterRender = () => {},

    // TransformFeedback
    varyings = null,
    bufferMode = GL.SEPARATE_ATTRIBS,

    // Other opts
    timerQueryEnabled = false
  } = {}) {
    this._initializeProgram({
      vs,
      fs,
      modules,
      defines,
      moduleSettings,
      defaultUniforms,
      program,
      shaderCache,
      varyings,
      bufferMode
    });

    this.uniforms = {};

    // Make sure we have some reasonable default uniforms in place
    uniforms = Object.assign({}, this.program.defaultUniforms, uniforms);
    this.setUniforms(uniforms);
    // Get all default uniforms
    this.setUniforms(this.getModuleUniforms());
    // Get unforms for supplied parameters
    this.setUniforms(this.getModuleUniforms(moduleSettings));

    if (instanced) {
      /* global console */
      /* eslint-disable no-console */
      console.warn(MSG_INSTANCED_PARAM_DEPRECATED);
      isInstanced = isInstanced || instanced;
    }

    // All attributes
    this._attributes = {};
    // User defined attributes
    this.attributes = {};
    this.samplers = {};
    this.userData = {};
    this.drawParams = {};
    this.dynamic = false;
    this.needsRedraw = true;

    // Attributes and buffers
    if (geometry) {
      this.setGeometry(geometry);
    }

    this.setAttributes(attributes);

    // geometry might have set drawMode and vertexCount
    if (drawMode !== undefined) {
      this.drawMode = getDrawMode(drawMode);
    }
    if (vertexCount !== undefined) {
      this.vertexCount = vertexCount;
    }
    this.isInstanced = isInstanced;
    this.instanceCount = instanceCount;

    // picking options
    this.pickable = Boolean(pickable);
    this.pick = pick || (() => false);

    this.onBeforeRender = onBeforeRender;
    this.onAfterRender = onAfterRender;

    // assert(program || program instanceof Program);
    assert(this.drawMode !== undefined && Number.isFinite(this.vertexCount), ERR_MODEL_PARAMS);

    this.timerQueryEnabled = timerQueryEnabled && Query.isSupported(this.gl, {timer: true});
    this.timeElapsedQuery = undefined;
    this.lastQueryReturned = true;

    this.stats = {
      accumulatedFrameTime: 0,
      averageFrameTime: 0,
      profileFrameCount: 0
    };
  }
  /* eslint-enable max-statements */

  delete() {
    // delete all attributes created by this model
    for (const key in this._attributes) {
      if (this._attributes[key] !== this.attributes[key]) {
        this._attributes[key].delete();
      }
    }

    this.program.delete();
    removeModel(this.id);
  }

  destroy() {
    this.delete();
  }

  setNeedsRedraw(redraw = true) {
    this.needsRedraw = redraw;
    return this;
  }

  getNeedsRedraw({clearRedrawFlags = false} = {}) {
    let redraw = false;
    redraw = redraw || this.needsRedraw;
    this.needsRedraw = this.needsRedraw && !clearRedrawFlags;
    if (this.geometry) {
      redraw = redraw || this.geometry.getNeedsRedraw({clearRedrawFlags});
    }
    return redraw;
  }

  setDrawMode(drawMode) {
    this.drawMode = getDrawMode(drawMode);
    return this;
  }

  getDrawMode() {
    return this.drawMode;
  }

  setVertexCount(vertexCount) {
    assert(Number.isFinite(vertexCount));
    this.vertexCount = vertexCount;
    return this;
  }

  getVertexCount() {
    return this.vertexCount;
  }

  setInstanceCount(instanceCount) {
    assert(Number.isFinite(instanceCount));
    this.instanceCount = instanceCount;
    return this;
  }

  getInstanceCount() {
    return this.instanceCount;
  }

  getProgram() {
    return this.program;
  }

  get varyingMap() {
    return this.program.varyingMap;
  }

  // TODO - just set attributes, don't hold on to geometry
  setGeometry(geometry) {
    this.geometry = geometry;
    this.vertexCount = geometry.getVertexCount();
    this.drawMode = geometry.drawMode;
    this._createBuffersFromAttributeDescriptors(this.geometry.getAttributes());
    this.setNeedsRedraw();
    return this;
  }

  getAttributes() {
    return this.attributes;
  }

  setAttributes(attributes = {}) {
    // Reutrn early if no attributes to set.
    if (isObjectEmpty(attributes)) {
      return this;
    }

    Object.assign(this.attributes, attributes);
    this._createBuffersFromAttributeDescriptors(attributes);
    this.setNeedsRedraw();

    return this;
  }

  getUniforms() {
    return this.uniforms;
  }

  // TODO - should actually set the uniforms
  setUniforms(uniforms = {}) {
    // TODO: we are still setting these uniforms in deck.gl so we don't break any external
    // application, these are marked deprecated in 5.0, remove them in deck.gl in 6.0.
    // Disabling since it gets too noisy in console, these are documented as deprecated.
    // this._checkForDeprecatedUniforms(uniforms);
    let somethingChanged = false;
    for (const key in uniforms) {
      if (!areUniformsEqual(this.uniforms[key], uniforms[key])) {
        somethingChanged = true;
        break;
      }
    }

    if (somethingChanged) {
      checkUniformValues(uniforms, this.id);
      Object.assign(this.uniforms, uniforms);
      this.setNeedsRedraw();
    }
    return this;
  }

  // getModuleUniforms (already on object)

  updateModuleSettings(opts) {
    const uniforms = this.getModuleUniforms(opts);
    return this.setUniforms(uniforms);
  }

  draw({
    moduleSettings = null,
    uniforms = {},
    attributes = {},
    samplers = {},
    parameters = {},
    settings,
    framebuffer = null,
    vertexArray = null,
    transformFeedback = null
  } = {}) {
    if (settings) {
      log.deprecated('settings', 'parameters')();
      parameters = settings;
    }

    if (moduleSettings) {
      this.updateModuleSettings(moduleSettings);
    }

    if (framebuffer) {
      parameters = Object.assign(parameters, {framebuffer});
    }

    this.render(uniforms, attributes, samplers, transformFeedback, parameters, vertexArray);

    if (framebuffer) {
      framebuffer.log({priority: LOG_DRAW_PRIORITY, message: `Rendered to ${framebuffer.id}`});
    }

    return this;
  }

  /* eslint-disable max-params  */
  render(
    uniforms = {},
    attributes = {},
    samplers = {},
    transformFeedback = null,
    parameters = {},
    vertexArray = null
  ) {
    addModel(this);

    const resolvedUniforms = this.addViewUniforms(uniforms);
    getOverrides(this.id, resolvedUniforms);

    this.setUniforms(resolvedUniforms);
    this.setAttributes(attributes);
    Object.assign(this.samplers, samplers);

    log.group(LOG_DRAW_PRIORITY,
      `>>> RENDERING MODEL ${this.id}`, {collapsed: log.priority <= 2})();

    this.setProgramState({vertexArray});

    this._logAttributesAndUniforms(2, resolvedUniforms);

    this.onBeforeRender();

    const drawParams = this.drawParams;
    if (drawParams.isInstanced && !this.isInstanced) {
      log.warn('Found instanced attributes on non-instanced model')();
    }
    const {isIndexed, indexType} = drawParams;
    const {isInstanced, instanceCount} = this;

    this._timerQueryStart();

    this.program.draw({
      parameters,
      drawMode: this.getDrawMode(),
      vertexCount: this.getVertexCount(),
      vertexArray,
      transformFeedback,
      isIndexed,
      indexType,
      isInstanced,
      instanceCount
    });

    this._timerQueryEnd();

    this.onAfterRender();

    this.unsetProgramState();

    this.setNeedsRedraw(false);

    log.groupEnd(LOG_DRAW_PRIORITY, `>>> RENDERING MODEL ${this.id}`)();

    return this;
  }
  /* eslint-enable max-params  */

  setProgramState({vertexArray = null} = {}) {
    const {program} = this;
    program.use();
    this.drawParams = {};
    program.setAttributes(this._attributes, {drawParams: this.drawParams});
    program.checkAttributeBindings({vertexArray});
    program.setUniforms(this.uniforms, this.samplers);
    return this;
  }

  unsetProgramState() {
    // Ensures all vertex attributes are disabled and ELEMENT_ARRAY_BUFFER
    // is unbound
    this.program.unsetBuffers();
    return this;
  }

  // DEPRECATED METHODS

  // TODO - uniform names are too strongly linked camera <=> default shaders
  // At least all special handling is collected here.
  addViewUniforms(uniforms) {
    // TODO - special treatment of these parameters should be removed
    const {camera, viewMatrix, modelMatrix} = uniforms;
    // Camera exposes uniforms that can be used directly in shaders
    const cameraUniforms = camera ? camera.getUniforms() : {};

    const viewUniforms = viewMatrix ?
      this.getCoordinateUniforms(viewMatrix, modelMatrix) : {};

    return Object.assign({}, uniforms, cameraUniforms, viewUniforms);
  }

  // PRIVATE METHODS

  _initializeProgram({
    vs,
    fs,
    modules,
    defines,
    moduleSettings,
    defaultUniforms,
    program,
    shaderCache,
    varyings,
    bufferMode
  }) {

    this.getModuleUniforms = x => {};

    if (!program) {
      // Assign default shaders if none are provided
      if (!vs) {
        vs = MODULAR_SHADERS.vs;
      }
      if (!fs) {
        fs = MODULAR_SHADERS.fs;
      }

      const assembleResult = assembleShaders(this.gl, {vs, fs, modules, defines});
      ({vs, fs} = assembleResult);

      if (shaderCache) {
        program = shaderCache.getProgram(this.gl, {vs, fs, id: this.id});
      } else {
        program = new Program(this.gl, {vs, fs, varyings, bufferMode});
      }

      const {getUniforms} = assembleResult;
      this.getModuleUniforms = getUniforms || (x => {});
    }

    this.program = program;
    assert(this.program instanceof Program, 'Model needs a program');
  }
  /* eslint-enable complexity */

  _checkForDeprecatedUniforms(uniforms) {
    // deprecated picking uniforms
    DEPRECATED_PICKING_UNIFORMS.forEach((uniform) => {
      if (uniform in uniforms) {
        log.deprecated(uniform,
          'use picking shader module and Model class updateModuleSettings()')();
      }
    });
  }

  _timerQueryStart() {
    if (this.timerQueryEnabled === true) {
      if (!this.timeElapsedQuery) {
        this.timeElapsedQuery = new Query(this.gl);
      }
      if (this.lastQueryReturned) {
        this.lastQueryReturned = false;
        this.timeElapsedQuery.beginTimeElapsedQuery();
      }
    }
  }

  _timerQueryEnd() {
    if (this.timerQueryEnabled === true) {
      this.timeElapsedQuery.end();
      // TODO: Skip results if 'gl.getParameter(this.ext.GPU_DISJOINT_EXT)' returns false
      // should this be incorporated into Query object?
      if (this.timeElapsedQuery.isResultAvailable()) {
        this.lastQueryReturned = true;
        const elapsedTime = this.timeElapsedQuery.getResult();

        // Update stats (e.g. for seer)
        this.stats.lastFrameTime = elapsedTime;
        this.stats.accumulatedFrameTime += elapsedTime;
        this.stats.profileFrameCount++;
        this.stats.averageFrameTime =
          this.stats.accumulatedFrameTime / this.stats.profileFrameCount;

        // Log stats
        log.log(LOG_DRAW_PRIORITY, `\
GPU time ${this.program.id}: ${this.stats.lastFrameTime}ms \
average ${this.stats.averageFrameTime}ms \
accumulated: ${this.stats.accumulatedFrameTime}ms \
count: ${this.stats.profileFrameCount}`
        )();
      }
    }
  }

  // Makes sure buffers are created for all attributes
  // and that the program is updated with those buffers
  // TODO - do we need the separation between "attributes" and "buffers"
  // couldn't apps just create buffers directly?
  _createBuffersFromAttributeDescriptors(attributes) {
    const {program: {gl}} = this;

    for (const attributeName in attributes) {
      const descriptor = attributes[attributeName];
      let attribute = this._attributes[attributeName];

      if (descriptor instanceof Attribute) {
        attribute = descriptor;
      } else if (descriptor instanceof Buffer) {
        attribute = attribute || new Attribute(gl, Object.assign({}, descriptor.layout, {
          id: attributeName
        }));
        attribute.update({isGeneric: false, buffer: descriptor});
      } else if (attribute) {
        attribute.update(descriptor);
      } else {
        attribute = new Attribute(gl, descriptor);
      }
      this._attributes[attributeName] = attribute;
    }

    return this;
  }

  _logAttributesAndUniforms(priority, uniforms = {}) {
    if (log.priority >= priority) {
      const attributeTable = this._getAttributesTable({
        header: `${this.id} attributes`,
        program: this.program,
        attributes: this._attributes
      });
      log.table(priority, attributeTable)();

      const {table, unusedTable, unusedCount} = getUniformsTable({
        header: `${this.id} uniforms`,
        program: this.program,
        uniforms: Object.assign({}, this.uniforms, uniforms)
      });

      log.table(priority, table)();
      log.log(priority, `${unusedCount || 'No'} unused uniforms `, unusedTable)();
    } else {
      // Always log missing uniforms
      const {table, count} = getUniformsTable({
        header: `${this.id} uniforms`,
        program: this.program,
        uniforms: Object.assign({}, this.uniforms, uniforms),
        undefinedOnly: true
      });
      if (count > 0) {
        log.table(priority, table)();
      }
    }

    logModel(this, uniforms);
  }

  // Todo move to attributes manager
  _getAttributesTable({
    attributes,
    header = 'Attributes',
    instanced,
    program
  } = {}) {
    assert(program);
    const attributeLocations = program._attributeToLocationMap;
    const table = {}; // {[header]: {}};

    // Add index if available
    for (const attributeName in attributes) {
      const attribute = attributes[attributeName];
      if (attribute.isIndexed) {
        this._createAttributeEntry(attribute, 'ELEMENT_ARRAY_BUFFER', header);
      }
    }

    // Add used attributes
    for (const attributeName in attributeLocations) {
      const attribute = attributes[attributeName];
      const location = attributeLocations[attributeName];
      table[attributeName] = this._createAttributeEntry(attribute, location, header);
    }

    // Add any unused attributes
    for (const attributeName in attributes) {
      const attribute = attributes[attributeName];
      if (!table[attributeName]) {
        table[attributeName] = this._createAttributeEntry(attribute, null, header);
      }
    }

    return table;
  }

  _createAttributeEntry(attribute, location, header) {
    const round = num => Math.round(num * 10) / 10;

    let type = 'NOT PROVIDED';
    let instanced = 0;
    let size = 'N/A';
    let verts = 'N/A';
    let bytes = 'N/A';
    let value = 'N/A';

    if (attribute && location === null) {
      location = attribute.isIndexed ? 'ELEMENT_ARRAY_BUFFER' : 'NOT USED';
    }

    if (attribute) {
      type = attribute.type;
      instanced = attribute.instanced;
      size = attribute.size;
      if (attribute.externalBuffer) {
        value = attribute.externalBuffer.data;
        bytes = attribute.externalBuffer.bytes;
        verts = bytes / value.BYTES_PER_ELEMENT;
      } else if (attribute.value) {
        value = attribute.value;
        verts = round(value.length / size);
        bytes = value.length * value.BYTES_PER_ELEMENT;
      }
    }

    // Generate a type name by dropping Array from Float32Array etc.
    type = String(type).replace('Array', '');
    // Look for 'nt' to detect integer types, e.g. Int32Array, Uint32Array
    const isInteger = type.indexOf('nt') !== -1;

    return {
      [header]: formatValue(value, {size, isInteger}),
      'Memory Size and Layout':
        `${instanced ? 'I ' : 'P '} ${verts} (x${size}=${bytes}bytes ${type}) loc=${location}`
    };
  }

  // DEPRECATED / REMOVED
  isPickable() {
    return this.pickable;
  }

  setPickable(pickable = true) {
    this.pickable = Boolean(pickable);
    return this;
  }

  getGeometry() {
    return this.geometry;
  }
}
