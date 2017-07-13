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

import sys

if sys.version_info[0] == 2:

    from cStringIO import StringIO as BufferIO

    def binary_to_str(bin_val):
        return bin_val

    def str_to_binary(str_val):
        return str_val

else:

    from io import BytesIO as BufferIO  # noqa

    def binary_to_str(bin_val):
        return bin_val.decode('utf8')

    def str_to_binary(str_val):
        return bytes(str_val, 'utf8')
