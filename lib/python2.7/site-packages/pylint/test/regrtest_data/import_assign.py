import shmixml.dom.minidom
import xml.dom.minidom

if 'dom' not in xml.__dict__:
  xml.dom = shmixml.dom
