
import urllib

class Page(object):
    _urlOpen = staticmethod(urllib.urlopen)

    def getPage(self, url):
        handle = self._urlOpen(url)
        data = handle.read()
        handle.close()
        return data
