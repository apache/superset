// WebGL2 Query (also handles disjoint timer extensions)
/* global requestAnimationFrame */
import Resource from './resource';
import {FEATURES, hasFeatures} from '../features';
import {isWebGL2} from '../webgl-utils';
import {assert} from '../utils';

const GL_QUERY_RESULT = 0x8866; // Returns a GLuint containing the query result.
const GL_QUERY_RESULT_AVAILABLE = 0x8867; // whether query result is available.

const GL_TIME_ELAPSED_EXT = 0x88bf; // Elapsed time (in nanoseconds).
const GL_GPU_DISJOINT_EXT = 0x8fbb; // Whether GPU performed any disjoint operation.

const GL_TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN = 0x8c88; // #primitives written to feedback buffers
const GL_ANY_SAMPLES_PASSED = 0x8c2f; // Occlusion query (if drawing passed depth test)
const GL_ANY_SAMPLES_PASSED_CONSERVATIVE = 0x8d6a; // Occlusion query less accurate/faster version

export default class Query extends Resource {
  // Returns true if Query is supported by the WebGL implementation
  // Can also check whether timestamp queries are available.
  static isSupported(gl, opts = []) {
    const webgl2 = isWebGL2(gl);

    // Initial value
    const hasTimerQuery = hasFeatures(gl, FEATURES.TIMER_QUERY);
    let supported = webgl2 || hasTimerQuery;

    for (const key of opts) {
      switch (key) {
        case 'queries':
          supported = supported && webgl2;
          break;
        case 'timers':
          supported = supported && hasTimerQuery;
          break;
        default:
          assert(false);
      }
    }

    return supported;
  }

  // Create a query class
  constructor(gl, opts = {}) {
    super(gl, opts);

    this.target = null;
    this._queryPending = false;
    this._pollingPromise = null;

    Object.seal(this);
  }

  // Shortcut for timer query (dependent on extension in both WebGL1 and 2)
  // Measures GPU time delta between this call and a matching `end` call in the
  // GPU instruction stream.
  beginTimeElapsedQuery() {
    return this.begin(GL_TIME_ELAPSED_EXT);
  }

  // Shortcut for occlusion queries
  beginOcclusionQuery({conservative = false} = {}) {
    return this.begin(conservative ? GL_ANY_SAMPLES_PASSED_CONSERVATIVE : GL_ANY_SAMPLES_PASSED);
  }

  // Shortcut for transformFeedbackQuery
  beginTransformFeedbackQuery() {
    return this.begin(GL_TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN);
  }

  // Due to OpenGL API limitations, after calling `begin()` on one Query
  // instance, `end()` must be called on that same instance before
  // calling `begin()` on another query. While there can be multiple
  // outstanding queries representing disjoint `begin()`/`end()` intervals.
  // It is not possible to interleave or overlap `begin` and `end` calls.
  begin(target) {
    // Don't start a new query if one is already active.
    if (this._queryPending) {
      return this;
    }

    this.target = target;
    this.gl.beginQuery(this.target, this.handle);

    return this;
  }

  // ends the current query
  end() {
    // Can't end a new query if the last one hasn't been resolved.
    if (this._queryPending) {
      return this;
    }

    if (this.target) {
      this.gl.endQuery(this.target);
      this.target = null;
      this._queryPending = true;
    }
    return this;
  }

  // Returns true if the query result is available
  isResultAvailable() {
    if (!this._queryPending) {
      return false;
    }

    const resultAvailable = this.gl.getQueryParameter(this.handle, GL_QUERY_RESULT_AVAILABLE);
    if (resultAvailable) {
      this._queryPending = false;
    }
    return resultAvailable;
  }

  // Timing query is disjoint, i.e. results are invalid
  isTimerDisjoint() {
    return this.gl.getParameter(GL_GPU_DISJOINT_EXT);
  }

  // Returns query result.
  getResult() {
    return this.gl.getQueryParameter(this.handle, GL_QUERY_RESULT);
  }

  // Returns the query result, converted to milliseconds to match JavaScript conventions.
  getTimerMilliseconds() {
    return this.getResult() / 1e6;
  }

  // Polls the query
  createPoll(limit = Number.POSITIVE_INFINITY) {
    if (this._pollingPromise) {
      return this._pollingPromise;
    }

    let counter = 0;

    this._pollingPromise = new Promise((resolve, reject) => {
      const poll = () => {
        if (this.isResultAvailable()) {
          resolve(this.getResult());
          this._pollingPromise = null;
        } else if (counter++ > limit) {
          reject('Timed out');
          this._pollingPromise = null;
        } else {
          requestAnimationFrame(poll);
        }
      };

      requestAnimationFrame(poll);
    });

    return this._pollingPromise;
  }

  _createHandle() {
    return Query.isSupported(this.gl) ? this.gl.createQuery() : null;
  }

  _deleteHandle() {
    this.gl.deleteQuery(this.handle);
  }
}
