# Note for editing Makefile : Makefile requires Tab to identify commands


SHELL := /bin/bash


publish-all:
	clean 
	build-rpms 
	publish-rpms


publish-rpms:
	@echo "= = = = = = = > START TARGET : [publish-rpms] < = = = = = = ="
	cd rpm-mgmt; ./deploy_rpms.sh
	@echo "= = = = = = = = > END TARGET : [publish-rpms] < = = = = = = ="


build-rpms: dist
	cd rpm-mgmt && rm -rf .package && ./build_rpm.sh 


clean:
	@echo "= = = = = = = > START TARGET : [clean] < = = = = = = ="
	rm -rf dist
	@echo "= = = = = = = = > END TARGET : [clean] < = = = = = = ="


dist:
	mkdir -p dist/installer


.PHONY: publish-all publish-rpms clean dist build-rpms