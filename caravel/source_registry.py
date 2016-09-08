
from flask import flash

class SourceRegistry(object):
	intances = 0

	__sources = {}

	def __init__(self, sources={}):
		self.__sources = sources
		self.intances += 1
	   
	def add_source(self, ds_type, cls_model):
		if ds_type not in self.__sources:
			self.__sources[ds_type] = cls_model
		if self.__sources[ds_type] is not cls_model:
			flash('source type: {} is already associated with Model: {}'.format(ds_type, self.__sources[ds_type]))

	def delete_source(self, ds_type):
		del self.__sources[ds_type]
	
	def get_cls_model(self, ds_type):
		return self.__sources[ds_type]

	@property
	def all_sources(self):
		return self.__sources

	@property
	def get_instances(self):
		return self.intances

	