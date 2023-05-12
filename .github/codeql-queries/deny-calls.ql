import python

from Call call, Name name
where call.getFunc() = name and
    name.getId() in ["os.system","subprocess.run","subprocess.call","eval","exec","execfile"]
select call, "Superset denied call found"
