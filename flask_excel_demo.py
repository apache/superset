# insert database related code here

from flask_sqlalchemy import SQLAlchemy  # sql operations
import pyexcel.ext.xls # import it to be able to handle xls file format

# connection to the database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tmp.db'
db = SQLAlchemy(app)

# models for the uploaded files
class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(80))
    body = db.Column(db.Text)
    pub_date = db.Column(db.DateTime)

    category_id = db.Column(db.Integer, db.ForeignKey('category.id'))
    category = db.relationship('Category',
        backref=db.backref('posts', lazy='dynamic'))

    def __init__(self, title, body, category, pub_date=None):
        self.title = title
        self.body = body
        if pub_date is None:
            pub_date = datetime.utcnow()
        self.pub_date = pub_date
        self.category = category

    def __repr__(self):
        return '<Post %r>' % self.title

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50))

    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return '<Category %r>' % self.name

# Create tables in the database
db.create_all()

# View function for data import
@app.route("/import", methods=['GET', 'POST'])
def doimport():
    if request.method == 'POST':
        def category_init_func(row):
            c = Category(row['name'])
            c.id = row['id']
            return c
        def post_init_func(row):
            c = Category.query.filter_by(name=row['category']).first()
            p = Post(row['title'], row['body'], c, row['pub_date'])
            return p
        request.save_book_to_database(field_name='file', session=db.session,
                                      tables=[Category, Post],
                                      initializers=(category_init_func,
                                      post_init_func])
        return "Saved"
    return '''
    <!doctype html>
    <title>Upload an excel file</title>
    <h1>Excel file upload (xls, xlsx, ods please)</h1>
    <form action="" method=post enctype=multipart/form-data><p>
    <input type=file name=file><input type=submit value=Upload>
    </form>
    '''

# View function for data export
@app.route("/export", methods=['GET'])
def doexport():
    return excel.make_response_from_tables(db.session, [Category, Post], "xls")

# Visit http://localhost:5000/import and upload sample-data.xls . Then visit http://localhost:5000/export to download the data back.