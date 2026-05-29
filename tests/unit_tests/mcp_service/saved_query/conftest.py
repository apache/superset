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

"""
Conftest for saved_query MCP tool tests.

Patches the editable-install meta path finder to resolve the `superset`
package from the current worktree rather than the install-time worktree.
"""

import pathlib
import sys

# Worktree root is 4 levels above this file.
_WORKTREE_ROOT = str(pathlib.Path(__file__).parents[4])

# Patch the editable install MAPPING so `superset` resolves to this worktree.
for _finder in sys.meta_path:
    if hasattr(_finder, "MAPPING") and "superset" in getattr(_finder, "MAPPING", {}):
        _finder.MAPPING["superset"] = _WORKTREE_ROOT + "/superset"
        _finder.MAPPING["tests"] = _WORKTREE_ROOT + "/tests"
        break

# Also ensure our worktree is first in sys.path as a fallback.
if _WORKTREE_ROOT not in sys.path:
    sys.path.insert(0, _WORKTREE_ROOT)

# Evict any previously cached superset submodules that may have been loaded
# from the old worktree, so they're re-imported from the correct location.
_to_evict = [k for k in sys.modules if k == "superset" or k.startswith("superset.")]
for _key in _to_evict:
    del sys.modules[_key]
