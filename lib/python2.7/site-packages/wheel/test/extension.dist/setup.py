from setuptools import setup, Extension

try:
    unicode
    def u8(s):
        return s.decode('unicode-escape').encode('utf-8')
except NameError:
    def u8(s):
        return s.encode('utf-8')

setup(name='extension.dist',
      version='0.1',
      description=u8('A testing distribution \N{SNOWMAN}'),
      ext_modules=[
          Extension(name='extension', 
          sources=['extension.c'], 
          py_limited_api=True)
          ],
      )

