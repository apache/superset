import python

from FunctionCall call
where call.getTarget().getQualifiedName() in [
    "os.system",
    "subprocess.run",
    "subprocess.call",
    "eval",
    "exec",
    "execfile",
]
select call, call.getFile()
