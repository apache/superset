/**
 * @name Superset disallowed function calls
 * @description Warn about dangerous function calls even if args are in control
 * @kind problem
 * @problem.severity high
 * @id python/deny-calls
 * @tags security
 *       external/cwe/cwe-94
 */

import python

from Call call, Name name
where call.getFunc() = name and
    name.getId() in ["os.system","subprocess.run","subprocess.call","eval","exec","execfile"]
select call, "Superset denied call found"
