import python

from FunctionCall call, Expr use
where call.getTarget().getName() in ["os.system","subprocess.run","subprocess.call","eval","exec","execfile"]
select call, "Superset denied calls $@.", use, "here"
