# Copyright 2015 Cloudera Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from six import string_types, PY3

from libcpp cimport bool
from libc.stdint cimport uint32_t
from libcpp.string cimport string as string_t

cdef extern from 'saslwrapper.h' namespace 'saslwrapper':
    cdef cppclass ClientImpl:
        ClientImpl() except +
        bool setAttr(const string_t& key, const string_t& value)
        bool setAttr(const string_t& key, uint32_t value)
        bool init()
        bool start(const string_t& mechList, string_t& chosen, string_t& initialResponse)
        bool step(const string_t& challenge, string_t& response)
        bool encode(const string_t& clearText, string_t& cipherText)
        bool decode(const string_t& cipherText, string_t& clearText)
        bool getUserId(string_t& userId)
        bool getSSF(int *ssf)
        void getError(string_t& error)


cpdef string_t to_bytes(bytes_or_str):
    if PY3 and isinstance(bytes_or_str, string_types):
        return bytes_or_str.encode('utf-8')
    return bytes_or_str


cpdef to_string(bytes_or_str):
    if isinstance(bytes_or_str, bytes):
        return bytes_or_str.decode('utf-8')
    return bytes_or_str


cdef class Client:
    cdef ClientImpl _this

    cpdef setAttr(self, key, value):
        if isinstance(value, int):
            return self._this.setAttr(to_bytes(key), <uint32_t> value)
        elif isinstance(value, string_types):
            return self._this.setAttr(to_bytes(key), <string_t> to_bytes(value))

    cpdef init(self):
        return self._this.init()
    
    cpdef start(self, mech_list):
        cdef string_t chosen
        cdef string_t initial_response
        success = self._this.start(to_bytes(mech_list), chosen, initial_response)
        return (success, chosen, initial_response)
    
    cpdef step(self, challenge):
        cdef string_t response
        success = self._this.step(to_bytes(challenge), response)
        return (success, response)
    
    cpdef encode(self, clear_text):
        cdef string_t cipher_text
        success = self._this.encode(to_bytes(clear_text), cipher_text)
        return (success, cipher_text)
    
    cpdef decode(self, cipher_text):
        cdef string_t clear_text
        success = self._this.decode(to_bytes(cipher_text), clear_text)
        return (success, clear_text)
    
    cpdef getUserId(self):
        cdef string_t user_id
        success = self._this.getUserId(user_id)
        return (success, user_id)
    
    cpdef getSSF(self):
        cdef int ssf
        success = self._this.getSSF(&ssf)
        return (success, ssf)
    
    cpdef getError(self):
        cdef string_t error
        self._this.getError(error)
        return error
