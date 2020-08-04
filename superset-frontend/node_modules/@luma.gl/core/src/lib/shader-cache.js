import {VertexShader, FragmentShader, Program} from '@luma.gl/webgl';
import {assert} from '../utils';

export default class ShaderCache {
  /**
   * A cache of compiled shaders, keyed by shader source strings.
   * Compilation of long shaders can be time consuming.
   * By using this class, the application can ensure that each shader
   * is only compiled once.
   */
  constructor({gl, _cachePrograms = false} = {}) {
    assert(gl);
    this.gl = gl;
    this.vertexShaders = {};
    this.fragmentShaders = {};
    this.programs = {};
    this._cachePrograms = _cachePrograms;
  }

  /**
   * Deletes shader references
   * @return {ShaderCache} - returns this for chaining
   */
  delete() {
    // TODO - requires reference counting to avoid deleting shaders in use
    return this;
  }

  /**
   * Returns a compiled `VertexShader` object corresponding to the supplied
   * GLSL source code string, if possible from cache.
   *
   * @param {WebGLRenderingContext} gl - gl context
   * @param {String} source - Source code for shader
   * @return {VertexShader} - a compiled vertex shader
   */
  getVertexShader(gl, source) {
    assert(typeof source === 'string');
    assert(this._compareContexts(gl, this.gl));

    let shader = this.vertexShaders[source];
    if (!shader) {
      shader = new VertexShader(gl, source);
      this.vertexShaders[source] = shader;
    }
    return shader;
  }

  /**
   * Returns a compiled `VertexShader` object corresponding to the supplied
   * GLSL source code string, if possible from cache.
   * @param {WebGLRenderingContext} gl - gl context
   * @param {String} source - Source code for shader
   * @return {FragmentShader} - a compiled fragment shader, possibly from chache
   */
  getFragmentShader(gl, source) {
    assert(typeof source === 'string');
    assert(this._compareContexts(gl, this.gl));

    let shader = this.fragmentShaders[source];
    if (!shader) {
      shader = new FragmentShader(gl, source);
      this.fragmentShaders[source] = shader;
    }
    return shader;
  }

  // Retrive Shaders from cache if exists, otherwise create new instance.
  getProgram(gl, opts) {
    assert(this._compareContexts(gl, this.gl));
    assert(typeof opts.vs === 'string');
    assert(typeof opts.fs === 'string');
    assert(typeof opts.id === 'string');

    const cacheKey = this._getProgramKey(opts);
    let program = this.programs[cacheKey];
    if (program) {
      this._resetProgram(program);
      return program;
    }

    program = this._createNewProgram(gl, opts);

    // Check if program can be cached
    // Program caching is experimental and expects
    // each Model to have a unique-id (wich is used in key generation)
    if (this._cachePrograms && this._checkProgramProp(program)) {
      program._isCached = true;
      this.programs[cacheKey] = program;
    }

    return program;
  }

  _getProgramKey(opts) {
    return `${opts.id}-${opts.vs}-${opts.fs}`;
  }

  _checkProgramProp(program) {
    // Check for transform feedback props (varyings, etc), we can't key such programs for now
    return !program.varyings;
  }

  _createNewProgram(gl, opts) {
    const {vs, fs} = opts;
    const vertexShader = this.getVertexShader(gl, vs);
    const fragmentShader = this.getFragmentShader(gl, fs);
    return new Program(
      this.gl,
      Object.assign({}, opts, {
        vs: vertexShader,
        fs: fragmentShader
      })
    );
  }

  _resetProgram(program, opts) {
    program.reset();
  }

  // Handle debug contexts
  _compareContexts(gl1, gl2) {
    return (gl1.gl || gl1) === (gl2.gl || gl2);
  }
}
