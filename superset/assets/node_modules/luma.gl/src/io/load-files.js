/* eslint-disable guard-for-in, complexity, no-try-catch */
import assert from '../utils/assert';
import {loadFile, loadImage} from './browser-load';
import {Program, Texture2D} from '../webgl';
import {Model} from '../core';
import {Geometry} from '../geometry';

function noop() {}

export function loadTexture(gl, url, opts = {}) {
  const {urls, onProgress = noop} = opts;
  assert(typeof url === 'string', 'loadTexture: url must be string');

  return loadImages(Object.assign({urls, onProgress}, opts))
  .then(images => images.map((img, i) => {
    return new Texture2D(gl, Object.assign({id: urls[i]}, opts, {data: img}));
  }));
}

/*
 * Loads (Requests) multiple files asynchronously
 */
export function loadFiles(opts = {}) {
  const {urls, onProgress = noop} = opts;
  assert(urls.every(url => typeof url === 'string'), 'loadImages: {urls} must be array of strings');
  let count = 0;
  return Promise.all(urls.map(
    url => {
      const promise = loadFile(Object.assign({url}, opts));
      promise.then(file => onProgress({
        progress: ++count / urls.length,
        count,
        total: urls.length,
        url
      }));
      return promise;
    }
  ));
}

/*
 * Loads (requests) multiple images asynchronously
 */
export function loadImages(opts = {}) {
  const {urls, onProgress = noop} = opts;
  assert(urls.every(url => typeof url === 'string'), 'loadImages: {urls} must be array of strings');
  let count = 0;
  return Promise.all(urls.map(
    url => {
      const promise = loadImage(url, opts);
      promise.then(file => onProgress({
        progress: ++count / urls.length,
        count,
        total: urls.length,
        url
      }));
      return promise;
    }
  ));
}

export function loadTextures(gl, opts = {}) {
  const {urls, onProgress = noop} = opts;
  assert(urls.every(url => typeof url === 'string'),
    'loadTextures: {urls} must be array of strings');

  return loadImages(Object.assign({urls, onProgress}, opts))
  .then(images => images.map((img, i) => {
    let params = Array.isArray(opts.parameters) ? opts.parameters[i] : opts.parameters;
    params = params === undefined ? {} : params;
    return new Texture2D(gl, Object.assign({id: urls[i]}, params, {data: img}));
  }));
}

export function loadProgram(gl, opts = {}) {
  const {vs, fs, onProgress = noop} = opts;
  return loadFiles(Object.assign({urls: [vs, fs], onProgress}, opts))
  .then(
    ([vsText, fsText]) => new Program(gl, Object.assign({vs: vsText, fs: fsText}, opts))
  );
}

// Loads a simple JSON format
export function loadModel(gl, opts = {}) {
  const {url, onProgress = noop} = opts;
  return loadFiles(Object.assign({urls: [url], onProgress}, opts))
  .then(([file]) => parseModel(gl, Object.assign({file}, opts)));
}

export function parseModel(gl, opts = {}) {
  const {file, program = new Program(gl)} = opts;
  const json = typeof file === 'string' ? parseJSON(file) : file;
  // Remove any attributes so that we can create a geometry
  // TODO - change format to put these in geometry sub object?
  const attributes = {};
  const modelOptions = {};
  for (const key in json) {
    const value = json[key];
    if (Array.isArray(value)) {
      attributes[key] = key === 'indices' ? new Uint16Array(value) : new Float32Array(value);
    } else {
      modelOptions[key] = value;
    }
  }

  return new Model(gl, Object.assign(
    {program, geometry: new Geometry({attributes})},
    modelOptions,
    opts
  ));
}

function parseJSON(file) {
  try {
    return JSON.parse(file);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error}`);
  }
}
