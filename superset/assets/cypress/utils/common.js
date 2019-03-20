/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var CryptoJS = require("crypto-js");

export function encryptText(_m) {
  var _k = CryptoJS.enc.Utf8.parse('qw34sd78fh67asb1');
  var _i = CryptoJS.lib.WordArray.random(16);
  var _e = CryptoJS.AES.encrypt(_m, _k, {
      iv: _i
  });
  _e = _i.concat(_e.ciphertext).toString(CryptoJS.enc.Base64);

  return _e;
}

