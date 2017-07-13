import io
from lingua.extractors import Extractor
from lingua.extractors import Message
from lingua.extractors import get_extractor
from mako.ext.extract import MessageExtractor
from mako import compat


class LinguaMakoExtractor(Extractor, MessageExtractor):

    '''Mako templates'''
    extensions = ['.mako']
    default_config = {
        'encoding': 'utf-8',
        'comment-tags': '',
    }

    def __call__(self, filename, options, fileobj=None):
        self.options = options
        self.filename = filename
        self.python_extractor = get_extractor('x.py')
        if fileobj is None:
            fileobj = open(filename, 'rb')
        return self.process_file(fileobj)

    def process_python(self, code, code_lineno, translator_strings):
        source = code.getvalue().strip()
        if source.endswith(compat.b(':')):
            if source in (compat.b('try:'), compat.b('else:')) or source.startswith(compat.b('except')):
                source = compat.b('') # Ignore try/except and else
            elif source.startswith(compat.b('elif')):
                source = source[2:] # Replace "elif" with "if"
            source += compat.b('pass')
        code = io.BytesIO(source)
        for msg in self.python_extractor(
                self.filename, self.options, code, code_lineno -1):
            if translator_strings:
                msg = Message(msg.msgctxt, msg.msgid, msg.msgid_plural,
                              msg.flags,
                              compat.u(' ').join(
                                  translator_strings + [msg.comment]),
                              msg.tcomment, msg.location)
            yield msg
