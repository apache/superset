# -*- coding: iso-8859-1 -*-

import urllib

class Page(object):
    _urlOpen = staticmethod(urllib.urlopen)

    def getPage(self, url):
        handle = self._urlOpen(url)
        data = handle.read()
        handle.close()
        return data
    #_getPage

#Page

if __name__ == "__main__":
    import sys
    p = Page()
    print p.getPage(sys.argv[1])
