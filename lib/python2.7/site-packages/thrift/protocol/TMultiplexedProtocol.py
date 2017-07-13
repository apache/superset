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

from thrift.Thrift import TMessageType
from thrift.protocol import TProtocolDecorator

SEPARATOR = ":"


class TMultiplexedProtocol(TProtocolDecorator.TProtocolDecorator):
    def __init__(self, protocol, serviceName):
        TProtocolDecorator.TProtocolDecorator.__init__(self, protocol)
        self.serviceName = serviceName

    def writeMessageBegin(self, name, type, seqid):
        if (type == TMessageType.CALL or
                type == TMessageType.ONEWAY):
            self.protocol.writeMessageBegin(
                self.serviceName + SEPARATOR + name,
                type,
                seqid
            )
        else:
            self.protocol.writeMessageBegin(name, type, seqid)
