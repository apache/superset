"use strict";
const request = require("request");

module.exports = cookieJar => {
  const jarWrapper = request.jar();
  jarWrapper._jar = cookieJar;
  return jarWrapper;
};
