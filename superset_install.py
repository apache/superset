#!/usr/bin/env python2.7
#
# Author: Gowtham Sai
# Website: https://gowtham-sai.com
# Aritcle: blog.gowtham-sai.com (Will be updated soon)
# Date: 7th Dec, 2016.
# Purpose: BI Visualisation Tool Customisation & Configuration. 
# What this script do?
#		-- This script will install superset and configures everything. 
# Where do I need to modify the configuration?
#		-- There are few configuraiton files in this directory. Please go through the documentation. 
#
# Sigstamp: 7h3 !n5|d3r

import os
import sys
import mylog
import site
import getpass
import platform
import subprocess
import urllib

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
				"https://raw.githubusercontent.com/gowtham95india/superset/master/superset_variables.py"
				}


# Get the python installation direcory 
mylog.log("INFO", "Getting PYTHONPATH ")
install_dirs  = site.getsitepackages()

# Checking if superset is installed.
mylog.log("INFO", "Checking if superset installed?")
mylog.log("WARN", "Superset is installed.")
is_superset = sys.modules['superset']

if not is_superset:
	mylog.log("INFO", "Superset is not installed")
	mylog.log("INFO", "Installing Sueprset...")
	mylog.log("INFO", "Detecting OS Version")

	detected_paltform = platform.platform().lower()
	if "Darwin" in detected_paltform:
		os_name = 'Apple'
	elif "ubuntu" in detected_paltform:
		os_name = 'Ubuntu'
	elif "centos" in detected_paltform:
		os_name = "CentOS"
	else:
		my.log("FATAL", "Detecting OS Failed. Committing Suicide.")
		sys.exit(1)
	
def command_center(install_cmd):
	# Executes the commands and return False if failed to execute
	install_cmd = "echo '%s' | sudo -S "%sudo_pass + install_cmd 
	exec_cmd = subprocess.Popen(install_cmd, shell=True, stdout=subprocess.PIPE, stderrr=subprocess.PIPE)
	exec_output,exec_error = exec_cmd.communicate()
	if exec_cmd.returncode != 0:
		mylog.log("FATAL", "Error while installing superset. Check below and logs file:")
		mylog.log("INFO", exec_error)
		sys.exit(1)

def general_config():
	# Getting superset_config.py file.
	superset_config_raw = urllib.urlopen(CONFIG_CMDS['superset_config_url'])
	with open('superset_config.py', 'w') as superset_config_file:
		for line in superset_config_raw.readlines():
			superset_config_file.write(line)

	try:
		superset_mods = sys.modules['superset']
		superset_app_dir = superset_mods.APP_DIR
		superset_config_dir = superset_app_dir.replace('superset', '')
		if 'site-packages' in superset_app_dir:
			command_center("mv superset_config.py %s"%superset_config_dir)
		elif 'dist-packages' in superset_app_dir:
			superset_config_dir = superset_config_dir.replace("dist-packages", "site-packages")
			command_center("mv superset_config.sh %s"%superset_config_dir)

	except KeyError:
		mylog.log("FATAL", "Something gone horribly wrong. Committing Suicide.")
		sys.exit(1)

	# Installing few python lib
	command_center("pip install celery redis")

	if os_name == "Ubuntu":
		# Installing Redis for Celery as Cache
		command_center("apt-get install redis-server")

		# Installing RabbitMQ for Celery as Broker
		command_center("apt-get install rabbitmq-server")

	else:
		my.log("INFO", "Please install redis-server and rabbitmq-server for your os.")

	if os_name != "Apple":
		superset_variables_raw = urllib.urlopen(CONFIG_CMDS['superset_variables_url'])
		with open('superset_variables.py', 'w') as superset_variable_file:
			for line in superset_variables_raw.readlines():
				superset_config_file.write(line)

		command_center("mv superset_variables.sh /etc/profile.d/")
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
	mylog.log("INFO", "Configurign Superset...")
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
	mylog.log("INFO", "Configurign Superset...")
	general_config()

# Superset installation in OS X
def osx_installation():
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
