# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import platform
import socket
import subprocess

PORT_TIMEOUT = 5
PING_TIMEOUT = 5


def is_port_open(host: str, port: int) -> bool:
    """
    Test if a given port in a host is open.
    """
    # pylint: disable=invalid-name
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(PORT_TIMEOUT)
    try:
        s.connect((host, int(port)))
        s.shutdown(socket.SHUT_RDWR)
        return True
    except socket.error:
        return False
    finally:
        s.close()

    return False


def is_hostname_valid(host: str) -> bool:
    """
    Test if a given hostname can be resolved.
    """
    try:
        socket.gethostbyname(host)
        return True
    except socket.gaierror:
        return False

    return False


def is_host_up(host: str) -> bool:
    """
    Ping a host to see if it's up.

    Note that if we don't get a response the host might still be up,
    since many firewalls block ICMP packets.
    """
    param = "-n" if platform.system().lower() == "windows" else "-c"
    command = ["ping", param, "1", host]
    try:
        output = subprocess.call(command, timeout=PING_TIMEOUT)
    except subprocess.TimeoutExpired:
        return False

    return output == 0
