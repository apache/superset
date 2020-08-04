import {image} from 'vega-canvas';
import {loader} from 'vega-loader';
import {hasOwnProperty} from 'vega-util';

export default function ResourceLoader(customLoader) {
  this._pending = 0;
  this._loader = customLoader || loader();
}

var prototype = ResourceLoader.prototype;

prototype.pending = function() {
  return this._pending;
};

function increment(loader) {
  loader._pending += 1;
}

function decrement(loader) {
  loader._pending -= 1;
}

prototype.sanitizeURL = function(uri) {
  var loader = this;
  increment(loader);

  return loader._loader.sanitize(uri, {context:'href'})
    .then(function(opt) {
      decrement(loader);
      return opt;
    })
    .catch(function() {
      decrement(loader);
      return null;
    });
};

prototype.loadImage = function(uri) {
  const loader = this,
        Image = image();
  increment(loader);

  return loader._loader
    .sanitize(uri, {context: 'image'})
    .then(function(opt) {
      const url = opt.href;
      if (!url || !Image) throw {url: url};

      const img = new Image();

      // set crossOrigin only if cors is defined; empty string sets anonymous mode
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin
      const cors = hasOwnProperty(opt, 'crossOrigin') ? opt.crossOrigin : 'anonymous';
      if (cors != null) img.crossOrigin = cors;

      // attempt to load image resource
      img.onload = () => decrement(loader);
      img.onerror = () => decrement(loader);
      img.src = url;

      return img;
    })
    .catch(function(e) {
      decrement(loader);
      return {complete: false, width: 0, height: 0, src: e && e.url || ''};
    });
};

prototype.ready = function() {
  var loader = this;
  return new Promise(function(accept) {
    function poll(value) {
      if (!loader.pending()) accept(value);
      else setTimeout(function() { poll(true); }, 10);
    }
    poll(false);
  });
};
