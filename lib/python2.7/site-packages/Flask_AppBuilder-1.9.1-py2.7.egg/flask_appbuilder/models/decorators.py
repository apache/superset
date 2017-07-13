def renders(col_name):
	"""
        Use this decorator to map your custom Model properties to actual 
        Model db properties. As an example::
            
            class MyModel(Model):
                id = Column(Integer, primary_key=True)
                name = Column(String(50), unique = True, nullable=False)
                custom = Column(Integer(20))
                
                @renders('custom')
                def my_custom(self):
                    # will render this columns as bold on ListWidget
                    return Markup('<b>' + custom + '</b>')
                    
            class MyModelView(ModelView):
                datamodel = SQLAInterface(MyTable)
                list_columns = ['name', 'my_custom']
                            
    """
	def wrap(f):
		if not hasattr(f, '_col_name'):
			f._col_name = col_name
		return f
	return wrap
    