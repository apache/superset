#!/usr/bin/env bash

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

# A simple example of how to customize your python dependencies while re-using
# as much as the pinned ones from the true-and-tested ones

# first, create your own `requirements.in` file, as this example file
# see `requirements/requirements-custom-example.in` as an example

# copy the pinned dependency so that we can make it the target outpout for pip-compile
# here we're getting pip-compile into using its output as an input
cp requirements/development.txt requirements/requirements-custom-example.txt

# pip-compile mixing your input and output (which also acts as the basis)
pip-compile -o requirements-custom-example.in requirements-custom-example.in

# this ideally is done as part of the release process, whenever any
# of the files referenced here change, including requirements/development.txt
