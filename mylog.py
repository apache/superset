import sys
import os
import inspect
import time

# Logger Initialization
filedir = os.path.dirname(__file__)
filepath = os.path.join(filedir,'log.txt')
keeper = open(filepath,'a')


def write(msg,purpose):
	keeper.write(time.ctime()+': %s - %s.\n'%(purpose.upper(),msg))

def log(severity, msg, linenumber=False):

	SEVERITY_TO_COLOR_MAP = {'DEBUG':'0;37', 'INFO':'32', 'WARN':'33', 'ERROR':'31', 'FATAL':'31', 'UNKNOWN':'37'}

	(frame, filename, line_number, function_name, lines, index) = inspect.getouterframes(inspect.currentframe())[1]
	if linenumber: line_number = linenumber
	    
	callee = str(filename)+'#'+str(function_name)+':'+str(line_number)

	formatted_time = time.ctime()
	color = SEVERITY_TO_COLOR_MAP[severity]
	formatted_severity = severity

	sys.stdout.write("\033[0;37m{}\033[0m [\033[{}m{}\033[0m] \033[0;36m{}\033[0m \033[0;{}m{}\033[0m\n".format(formatted_time,color,formatted_severity,callee,color,msg))