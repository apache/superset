#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

from thrift.Thrift import TProcessor, TMessageType, TException
from thrift.protocol import TProtocolDecorator, TMultiplexedProtocol


class TMultiplexedProcessor(TProcessor):
    def __init__(self):
        self.services = {}

    def registerProcessor(self, serviceName, processor):
        self.services[serviceName] = processor

    def process(self, iprot, oprot):
        (name, type, seqid) = iprot.readMessageBegin()
        if type != TMessageType.CALL and type != TMessageType.ONEWAY:
            raise TException("TMultiplex protocol only supports CALL & ONEWAY")

        index = name.find(TMultiplexedProtocol.SEPARATOR)
        if index < 0:
            raise TException("Service name not found in message name: " + name + ". Did you forget to use TMultiplexProtocol in your client?")

        serviceName = name[0:index]
        call = name[index + len(TMultiplexedProtocol.SEPARATOR):]
        if serviceName not in self.services:
            raise TException("Service name not found: " + serviceName + ". Did you forget to call registerProcessor()?")

        standardMessage = (call, type, seqid)
        return self.services[serviceName].process(StoredMessageProtocol(iprot, standardMessage), oprot)


class StoredMessageProtocol(TProtocolDecorator.TProtocolDecorator):
    def __init__(self, protocol, messageBegin):
        TProtocolDecorator.TProtocolDecorator.__init__(self, protocol)
        self.messageBegin = messageBegin

    def readMessageBegin(self):
        return self.messageBegin
