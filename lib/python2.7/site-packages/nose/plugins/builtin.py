"""
Lists builtin plugins.
"""
plugins = []
builtins = (
    ('nose.plugins.attrib', 'AttributeSelector'),
    ('nose.plugins.capture', 'Capture'),
    ('nose.plugins.logcapture', 'LogCapture'),
    ('nose.plugins.cover', 'Coverage'),
    ('nose.plugins.debug', 'Pdb'),
    ('nose.plugins.deprecated', 'Deprecated'),
    ('nose.plugins.doctests', 'Doctest'),
    ('nose.plugins.isolate', 'IsolationPlugin'),
    ('nose.plugins.failuredetail', 'FailureDetail'),
    ('nose.plugins.prof', 'Profile'),
    ('nose.plugins.skip', 'Skip'),
    ('nose.plugins.testid', 'TestId'),
    ('nose.plugins.multiprocess', 'MultiProcess'),
    ('nose.plugins.xunit', 'Xunit'),
    ('nose.plugins.allmodules', 'AllModules'),
    ('nose.plugins.collect', 'CollectOnly'),
    )

for module, cls in builtins:
    try:
        plugmod = __import__(module, globals(), locals(), [cls])
    except KeyboardInterrupt:
        raise
    except:
        continue
    plug = getattr(plugmod, cls)
    plugins.append(plug)
    globals()[cls] = plug

