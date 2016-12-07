#!/usr/bin/env python2.7
#
# Author: Gowtham Sai
# Website: https://gowtham-sai.com
# Aritcle: blog.gowtham-sai.com (Will be updated soon)
# Date: 7th Aug, 2016.
# Purpose: BI Visualisation Tool Customisation & Configuration. 
# What this script do?
#		-- This script will install superset and configures everything. 
# Where do I need to modify the configuration?
#		-- There are few configuraiton files in this directory. Please go through the documentation. 
#
# Sigstamp: 7h3 !n5|d3r

import os
import sys
import site
import mylog
import socket
import urllib
import getpass
import platform
import subprocess

try:
	import pip
except ImportError:
	mylog.log("WARN", "Pip not installed.")
	mylog.log("INFO", "Superset might not be installed.")

# Getting Super User password.
sudo_pass = getpass.getpass("Please enter sudo password: ")

UBUNTU_CMDS = { "install_dependencies": 
				"apt-get install build-essential libssl-dev libffi-dev python-dev python-pip libsasl2-dev libldap2-dev",
				"pip_update": 
				"pip install --upgrade setuptools pip",
				"superset_install":
				"pip install git+https://github.com/Gowtham95india/superset.git",
			}

CENTOS_CMDS = { "init_install":
				"yum upgrade python-setuptools",
				"install_dependencies": 
				"yum install gcc libffi-devel python-devel python-pip python-wheel openssl-devel libsasl2-devel openldap-devel",
				"pip_update": 
				"pip install --upgrade setuptools pip",
				"superset_install":
				"pip install git+https://github.com/Gowtham95india/superset.git",
			}

DARWIN_CMDS = {	"install_dependencies": 
				"brew install pkg-config libffi openssl python",
				"brew_python":
				'env LDFLAGS="-L$(brew --prefix openssl)/lib" CFLAGS="-I$(brew --prefix openssl)/include" pip install cryptography',
				"pip_update": 
				"pip install --upgrade setuptools pip",
				"superset_install":
				"pip install git+https://github.com/Gowtham95india/superset.git",
			}			

CONFIG_CMDS = {"superset_config_url":
				"https://raw.githubusercontent.com/gowtham95india/superset/master/superset_config.py",
				"superset_variables_url":
				"https://raw.githubusercontent.com/gowtham95india/superset/master/superset_variables.sh"
				"nginx_config_url":
				"https://raw.githubusercontent.com/gowtham95india/superset/master/gowtham-sai.conf"
				}
	
def command_center(install_cmd, exit_on_fail=True):
	# Executes the commands and return False if failed to execute
	install_cmd = "echo '%s' | sudo -S "%sudo_pass + install_cmd 
	exec_cmd = subprocess.Popen(install_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
	exec_output,exec_error = exec_cmd.communicate()
	if exec_cmd.returncode != 0:
		mylog.log("FATAL", "Error while installing superset. Check below and logs file:")
		mylog.log("INFO", exec_error)
		return sys.exit(1) if exit_on_fail else (False,exec_error)
	return (True,exec_output)

def nginx_config():
	mylog.log("INFO", "Installing Nginx Recursively")
	if os_name.lower() == "ubuntu":
		command_center("apt-get -y install nginx")
	elif os_name.lower() == 'centos':
		command_center("yum -y install nginx")

	# Getting Machine IP for Nginx domain check & configuration.
	machine_ip = urllib.urlopen('http://ip.42.pl/raw').read()

	option = raw_input("\n\nIf you have your own domain to configure, please type yes/Yes/Y/y: ").lower()
	if option in ('yes', 'y'):
		mylog.log("WARN", "Please enter space separated domain names that should point to the superset:")
		domain_names = raw_input("\nSpace separated domain names: ").split(' ')
		corrected_domain_names = []
		for domain_name in domain_names:
			temp_domain = domain_name
			if 'https://' in temp_domain:
				temp_domain = temp_domain.replace('https://', '')
			if 'http://' in temp_domain:
				temp_domain = temp_domain.replace('http://','')
			corrected_domain_names.append(temp_domain)

		mapped_domains = {}
		for correct_domain in corrected_domain_names:
			try: 
				domain_result = socket.getaddrinfo(correct_domain,None)
				domain_ip = domain_result[0][4][0]
				if domain_ip != machine_ip:
					mylog.log("WARN", "Domain %s is not pointing to the machine."%correct_domain)
					mylog.log("INFO", "%s is pointing to %s insteaed of %s"%(correct_domain, domain_ip, machine_ip))
					domain_option = raw_input("Would you like to add %s to Nginx config? "%correct_domain).lower()
					if domain_option in ('y', 'yes'):
						mapped_domains[correct_domain] = domain_ip
				else:
					mylog.log("INFO", "Domain %s is configured correctly..!"%correct_domain)
					mapped_domains[correct_domain] = domain_ip
			except socket.gaierror:
				mylog.log("ERROR", correct_domain + ' is not a valid domain. Ignoring it!') 

		nginx_domain_string = ' '.join(crt_domain for crt_domain in mapped_domains.keys())
	
	else:
		mylog.log("INFO", "Configuring Nginx with  machine ip")
		mylog.log("WARN", "Not recommended to configure the bare ip")
		nginx_domain_string = machine_ip

	nginx_config_raw = urllib.urlopen(CONFIG_CMDS['nginx_config_url'])

	with open('gowtham-sai.conf','w') as nginx_config_file:
		for line in nginx_config_raw.readlines():
			if 'domainnameshouldbehere' in line:
				line = line.replace('domainnameshouldbehere', nginx_domain_string)
			nginx_config_file.write(line)
	
	# Finally moving confiugration file. 
	command_center("mv gowtham-sai.conf /etc/nginx/conf.d/")

	nginx_config_check = command_center("nginx -t", exit_on_fail=False)
	if nginx_config_check[0]:
		nginx_restart_status = command_center('systemctl restart nginx', exit_on_fail=False)
		if nginx_restart_status[0]:
			myglog.log("INFO", "Nginx Confiugration Done.")
		else:
			myglog.log("WARN", "Restrting Nginx Failed. May be due to %s"%nginx_restart_status[1])
	else:
		mylog.log("WARN", "Nginx configuration files has error. May be due to %s"%nginx_config_check[1])

def general_config():
	# Installing general pip dependencies
	mylog.log("INFO", "Installing few python dependencies") 
	command_center("pip install celery redis mysql-python")

	# Getting superset_config.py file.
	mylog.log("INFO", "Setting up external superset_config file.")
	superset_config_raw = urllib.urlopen(CONFIG_CMDS['superset_config_url'])
	with open('superset_config.py', 'w') as superset_config_file:
		for line in superset_config_raw.readlines():
			superset_config_file.write(line)

	try:
		superset_app_dir = None
		for directory in install_dirs:
			if os.path.isdir(directory+'/superset'):
				superset_app_dir = directory+'/superset'
		if not superset_app_dir: raise ImportError
		superset_config_dir = superset_app_dir.replace('superset', '')
		command_center("mv superset_config.py %s"%superset_config_dir)

	except ImportError:
		mylog.log("FATAL", "Something gone horribly wrong. Committing Suicide.")
		sys.exit(1)

	if os_name.lower() == "ubuntu":
		# Installing Redis Server for Celery Cache and RabbitMQ Server for Celery Broker
		mylog.log("INFO", "Installing Redis and RabbitMQ Servers for Celery.")
		command_center("apt-get -y install redis-server")
		command_center("apt-get -y install rabbitmq-server")

	else:
		my.log("INFO", "Please install redis-server and rabbitmq-server for your os.")

	if os_name.lower() != "apple":
		# Setting up global system-wide variable files
		mylog.log("INFO", "Setting up global system-wide autoload variable file.")
		superset_variables_raw = urllib.urlopen(CONFIG_CMDS['superset_variables_url'])
		with open('superset_variables.sh', 'w') as superset_variable_file:
			for line in superset_variables_raw.readlines():
				superset_variable_file.write(line)
		command_center("mv superset_variables.sh /etc/profile.d/")
	
	# Configuring Nginx. 
	nginx_config()

	mylog.log("INFO", "Hurrah! Installation and Configuration Done Successfully..!")

# Superset installation in Ubuntu
def ubuntu_installation():
	mylog.log("INFO",
		"Detected OS as %s and installing Superset."%os_name)
	
	# Install dependencies
	command_center(UBUNTU_CMDS['install_dependencies'])

	# Update PIP
	command_center(UBUNTU_CMDS['pip_update'])

	# Install superset
	command_center(UBUNTU_CMDS['superset_install'])

	# General config. 
	mylog.log("INFO", "Installing Superset is done..!")
	mylog.log("INFO", "Configuring Superset...")
	general_config()

# Superset installation in CentOS
def centos_installation():
	mylog.log("INFO",
		"Detected OS as %s and installing Superset."%os_name)
	
	# Update setuptools
	command_center(CENTOS_CMDS['init_install'])

	# install dependencies
	command_center(CENTOS_CMDS['install_dependencies'])

	# Update PIP
	command_center(CENTOS_CMDS['pip_update'])

	# Install superset
	command_center(CENTOS_CMDS['superset_install'])	

	# General config. 
	mylog.log("INFO", "Installing Superset is done..!")
	mylog.log("INFO", "Configuring Superset...")
	general_config()

# Superset installation in OS X
def apple_installation():
	mylog.log("INFO",
		"Detected OS as %s and installing Superset."%os_name)
	
	# Install dependencies
	command_center(DARWIN_CMDS['install_dependencies'])

	# Set brew python as system python is not recommended
	command_center(DARWIN_CMDS['brew_python'])

	# Update PIP
	command_center(DARWIN_CMDS['pip_update'])

	# Install superset
	command_center(DARWIN_CMDS['superset_install'])

	mylog.log("INFO", "Hurrah! Installation Done Successfully..!")
	mylog.log9("WARN", "Automatic configuring superset is not available for OS X due to System Integrity Protection (rootless)")

def detect_os():
	detected_paltform = platform.platform().lower()
	if "Darwin" in detected_paltform:
		os_name = 'Apple'
		osx_installation()
	elif "ubuntu" in detected_paltform:
		os_name = 'Ubuntu'
		ubuntu_installation()
	elif "centos" in detected_paltform:
		os_name = "CentOS"
		centos_installation()
	return os_name if os_name else None

# Get the python installation direcory 
mylog.log("INFO", "Getting PYTHONPATH ")
install_dirs  = site.getsitepackages()

# Checking if superset is installed.
mylog.log("INFO", "Checking if superset installed?")
try: 
	import superset
	mylog.log("WARN", "Superset is installed.")
	os_name = detect_os()
	if os_name:
		mylog.log("INFO", "Configuring for General Purpose.")
		general_config()
	else:
		myglog.log("WARN", "Detecting OS Failed. Committing Suicide.")

except ImportError:
	mylog.log("INFO", "Superset is not installed")
	mylog.log("INFO", "Installing Sueprset...")
	mylog.log("INFO", "Detecting OS Version")

	os_name = detect_os()
	if os_name:
		exec(os_name.lower()+'_installation()')
	else:
		myglog.log("WARN", "Detecting OS Failed. Committing Suicide.")