/**
 * Wrapper for the toaster (https://github.com/nels-o/toaster)
 */
var path = require('path');
var notifier = path.resolve(__dirname, '../vendor/snoreToast/snoretoast');
var utils = require('../lib/utils');
var Balloon = require('./balloon');
var os = require('os');

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var fallback;

module.exports = WindowsToaster;

function WindowsToaster(options) {
  options = utils.clone(options || {});
  if (!(this instanceof WindowsToaster)) {
    return new WindowsToaster(options);
  }

  this.options = options;

  EventEmitter.call(this);
}
util.inherits(WindowsToaster, EventEmitter);

function noop() {}

var timeoutMessage = 'the toast has timed out';
var successMessage = 'user clicked on the toast';

function hasText(str, txt) {
  return str && str.indexOf(txt) !== -1;
}

WindowsToaster.prototype.notify = function(options, callback) {
  options = utils.clone(options || {});
  callback = callback || noop;
  var is64Bit = os.arch() === 'x64';

  if (typeof options === 'string') {
    options = { title: 'node-notifier', message: options };
  }

  if (typeof callback !== 'function') {
    throw new TypeError(
      'The second argument must be a function callback. You have passed ' +
        typeof fn
    );
  }

  var actionJackedCallback = utils.actionJackerDecorator(
    this,
    options,
    function cb(err, data) {
      /* Possible exit statuses from SnoreToast, we only want to include err if it's -1 code
      Exit Status     :  Exit Code
      Failed          : -1

      Success         :  0
      Hidden          :  1
      Dismissed       :  2
      TimedOut        :  3
      ButtonPressed   :  4
      TextEntered     :  5
      */
      if (err && err.code !== -1) {
        return callback(null, data);
      }
      callback(err, data);
    },
    function mapper(data) {
      if (hasText(data, successMessage)) {
        return 'click';
      }
      if (hasText(data, timeoutMessage)) {
        return 'timeout';
      }
      return false;
    }
  );

  options.title = options.title || 'Node Notification:';
  if (
    typeof options.message === 'undefined' &&
    typeof options.close === 'undefined'
  ) {
    callback(new Error('Message or ID to close is required.'));
    return this;
  }

  if (!utils.isWin8() && !utils.isWSL() && !!this.options.withFallback) {
    fallback = fallback || new Balloon(this.options);
    return fallback.notify(options, callback);
  }

  options = utils.mapToWin8(options);
  var argsList = utils.constructArgumentList(options, {
    explicitTrue: true,
    wrapper: '',
    keepNewlines: true,
    noEscape: true
  });

  var notifierWithArch = notifier + '-x' + (is64Bit ? '64' : '86') + '.exe';
  utils.fileCommand(
    this.options.customPath || notifierWithArch,
    argsList,
    actionJackedCallback
  );
  return this;
};
