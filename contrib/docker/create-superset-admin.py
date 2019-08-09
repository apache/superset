#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import subprocess
from contrib.docker import helpers


if __name__ == '__main__':
    the_secrets_provider = helpers.get_env_variable("SECRETS_PROVIDER")
    admin_secret = helpers.get_env_variable("SUPERSET_ADMIN_USER_SECRET")

    secret = helpers.get_secret(secrets_provider=the_secrets_provider, secret_key=admin_secret)
    username = secret['username']
    password = secret['password']
    email = secret['email']

    admin_command = [
        "flask", "fab", "create-admin", f"--username={username}", "--firstname=Superset", "--lastname=Admin",
        f"--password={password}", f"--email={email}"]
    subprocess.call(admin_command)

