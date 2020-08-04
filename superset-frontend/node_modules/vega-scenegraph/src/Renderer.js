import ResourceLoader from './ResourceLoader';

/**
 * Create a new Renderer instance.
 * @param {object} [loader] - Optional loader instance for
 *   image and href URL sanitization. If not specified, a
 *   standard loader instance will be generated.
 * @constructor
 */
export default function Renderer(loader) {
  this._el = null;
  this._bgcolor = null;
  this._loader = new ResourceLoader(loader);
}

var prototype = Renderer.prototype;

/**
 * Initialize a new Renderer instance.
 * @param {DOMElement} el - The containing DOM element for the display.
 * @param {number} width - The coordinate width of the display, in pixels.
 * @param {number} height - The coordinate height of the display, in pixels.
 * @param {Array<number>} origin - The origin of the display, in pixels.
 *   The coordinate system will be translated to this point.
 * @param {number} [scaleFactor=1] - Optional scaleFactor by which to multiply
 *   the width and height to determine the final pixel size.
 * @return {Renderer} - This renderer instance.
 */
prototype.initialize = function(el, width, height, origin, scaleFactor) {
  this._el = el;
  return this.resize(width, height, origin, scaleFactor);
};

/**
 * Returns the parent container element for a visualization.
 * @return {DOMElement} - The containing DOM element.
 */
prototype.element = function() {
  return this._el;
};

/**
 * Returns the scene element (e.g., canvas or SVG) of the visualization
 * Subclasses must override if the first child is not the scene element.
 * @return {DOMElement} - The scene (e.g., canvas or SVG) element.
 */
prototype.canvas = function() {
  return this._el && this._el.firstChild;
};

/**
 * Get / set the background color.
 */
prototype.background = function(bgcolor) {
  if (arguments.length === 0) return this._bgcolor;
  this._bgcolor = bgcolor;
  return this;
};

/**
 * Resize the display.
 * @param {number} width - The new coordinate width of the display, in pixels.
 * @param {number} height - The new coordinate height of the display, in pixels.
 * @param {Array<number>} origin - The new origin of the display, in pixels.
 *   The coordinate system will be translated to this point.
 * @param {number} [scaleFactor=1] - Optional scaleFactor by which to multiply
 *   the width and height to determine the final pixel size.
 * @return {Renderer} - This renderer instance;
 */
prototype.resize = function(width, height, origin, scaleFactor) {
  this._width = width;
  this._height = height;
  this._origin = origin || [0, 0];
  this._scale = scaleFactor || 1;
  return this;
};

/**
 * Report a dirty item whose bounds should be redrawn.
 * This base class method does nothing. Subclasses that perform
 * incremental should implement this method.
 * @param {Item} item - The dirty item whose bounds should be redrawn.
 */
prototype.dirty = function(/*item*/) {
};

/**
 * Render an input scenegraph, potentially with a set of dirty items.
 * This method will perform an immediate rendering with available resources.
 * The renderer may also need to perform image loading to perform a complete
 * render. This process can lead to asynchronous re-rendering of the scene
 * after this method returns. To receive notification when rendering is
 * complete, use the renderAsync method instead.
 * @param {object} scene - The root mark of a scenegraph to render.
 * @return {Renderer} - This renderer instance.
 */
prototype.render = function(scene) {
  var r = this;

  // bind arguments into a render call, and cache it
  // this function may be subsequently called for async redraw
  r._call = function() { r._render(scene); };

  // invoke the renderer
  r._call();

  // clear the cached call for garbage collection
  // async redraws will stash their own copy
  r._call = null;

  return r;
};

/**
 * Internal rendering method. Renderer subclasses should override this
 * method to actually perform rendering.
 * @param {object} scene - The root mark of a scenegraph to render.
 */
prototype._render = function(/*scene*/) {
  // subclasses to override
};

/**
 * Asynchronous rendering method. Similar to render, but returns a Promise
 * that resolves when all rendering is completed. Sometimes a renderer must
 * perform image loading to get a complete rendering. The returned
 * Promise will not resolve until this process completes.
 * @param {object} scene - The root mark of a scenegraph to render.
 * @return {Promise} - A Promise that resolves when rendering is complete.
 */
prototype.renderAsync = function(scene) {
  var r = this.render(scene);
  return this._ready
    ? this._ready.then(function() { return r; })
    : Promise.resolve(r);
};

/**
 * Internal method for asynchronous resource loading.
 * Proxies method calls to the ImageLoader, and tracks loading
 * progress to invoke a re-render once complete.
 * @param {string} method - The method name to invoke on the ImageLoader.
 * @param {string} uri - The URI for the requested resource.
 * @return {Promise} - A Promise that resolves to the requested resource.
 */
prototype._load = function(method, uri) {
  var r = this,
      p = r._loader[method](uri);

  if (!r._ready) {
    // re-render the scene when loading completes
    var call = r._call;
    r._ready = r._loader.ready()
      .then(function(redraw) {
        if (redraw) call();
        r._ready = null;
      });
  }

  return p;
};

/**
 * Sanitize a URL to include as a hyperlink in the rendered scene.
 * This method proxies a call to ImageLoader.sanitizeURL, but also tracks
 * image loading progress and invokes a re-render once complete.
 * @param {string} uri - The URI string to sanitize.
 * @return {Promise} - A Promise that resolves to the sanitized URL.
 */
prototype.sanitizeURL = function(uri) {
  return this._load('sanitizeURL', uri);
};

/**
 * Requests an image to include in the rendered scene.
 * This method proxies a call to ImageLoader.loadImage, but also tracks
 * image loading progress and invokes a re-render once complete.
 * @param {string} uri - The URI string of the image.
 * @return {Promise} - A Promise that resolves to the loaded Image.
 */
prototype.loadImage = function(uri) {
  return this._load('loadImage', uri);
};
