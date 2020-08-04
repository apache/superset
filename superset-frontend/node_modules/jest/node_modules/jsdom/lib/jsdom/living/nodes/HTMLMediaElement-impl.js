"use strict";
const DOMException = require("domexception");
const HTMLElementImpl = require("./HTMLElement-impl").implementation;
const notImplemented = require("../../browser/not-implemented");
const { reflectURLAttribute } = require("../../utils");
const { fireAnEvent } = require("../helpers/events");

function getTimeRangeDummy() {
  return {
    length: 0,
    start() {
      return 0;
    },
    end() {
      return 0;
    }
  };
}

class HTMLMediaElementImpl extends HTMLElementImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this._muted = false;
    this._volume = 1.0;
    this.readyState = 0;
    this.networkState = 0;
    this.currentTime = 0;
    this.currentSrc = "";
    this.buffered = getTimeRangeDummy();
    this.seeking = false;
    this.duration = NaN;
    this.paused = true;
    this.played = getTimeRangeDummy();
    this.seekable = getTimeRangeDummy();
    this.ended = false;
    this.audioTracks = [];
    this.videoTracks = [];
    this.textTracks = [];
  }
  // Implemented accoring to W3C Draft 22 August 2012
  set defaultPlaybackRate(v) {
    if (v === 0.0) {
      throw new DOMException("The operation is not supported.", "NotSupportedError");
    }
    if (this._defaultPlaybackRate !== v) {
      this._defaultPlaybackRate = v;
      this._dispatchRateChange();
    }
  }

  _dispatchRateChange() {
    fireAnEvent("ratechange", this);
  }
  get defaultPlaybackRate() {
    if (this._defaultPlaybackRate === undefined) {
      return 1.0;
    }
    return this._defaultPlaybackRate;
  }
  get playbackRate() {
    if (this._playbackRate === undefined) {
      return 1.0;
    }
    return this._playbackRate;
  }
  set playbackRate(v) {
    if (v !== this._playbackRate) {
      this._playbackRate = v;
      this._dispatchRateChange();
    }
  }
  get muted() {
    return this._muted;
  }
  _dispatchVolumeChange() {
    fireAnEvent("volumechange", this);
  }
  set muted(v) {
    if (v !== this._muted) {
      this._muted = v;
      this._dispatchVolumeChange();
    }
  }
  get defaultMuted() {
    return this.getAttributeNS(null, "muted") !== null;
  }
  set defaultMuted(v) {
    if (v) {
      this.setAttributeNS(null, "muted", v);
    } else {
      this.removeAttributeNS(null, "muted");
    }
  }
  get volume() {
    return this._volume;
  }
  set volume(v) {
    if (v < 0 || v > 1) {
      throw new DOMException("The index is not in the allowed range.", "IndexSizeError");
    }
    if (this._volume !== v) {
      this._volume = v;
      this._dispatchVolumeChange();
    }
  }

  // Not (yet) implemented according to spec
  // Should return sane default values
  load() {
    notImplemented("HTMLMediaElement.prototype.load", this._ownerDocument._defaultView);
  }
  canPlayType() {
    return "";
  }
  play() {
    notImplemented("HTMLMediaElement.prototype.play", this._ownerDocument._defaultView);
  }
  pause() {
    notImplemented("HTMLMediaElement.prototype.pause", this._ownerDocument._defaultView);
  }
  addTextTrack() {
    notImplemented("HTMLMediaElement.prototype.addTextTrack", this._ownerDocument._defaultView);
  }

  get src() {
    return reflectURLAttribute(this, "src");
  }

  set src(value) {
    this.setAttributeNS(null, "src", value);
  }
}

module.exports = {
  implementation: HTMLMediaElementImpl
};
