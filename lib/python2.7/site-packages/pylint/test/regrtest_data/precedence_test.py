"""
  # package/__init__.py
  class AudioTime(object):
    DECIMAL = 3

  # package/AudioTime.py
  class AudioTime(object):
    pass

  # test.py
  from package import AudioTime
  # E0611 - No name 'DECIMAL' in module 'AudioTime.AudioTime'
  print AudioTime.DECIMAL

"""
from __future__ import print_function
from package import AudioTime
__revision__ = 0


print(AudioTime.DECIMAL)
