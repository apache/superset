from datetime import time
import os
from flask import Flask, render_template, request, redirect, url_for
from statistics import mean
from flask.helpers import flash
import numpy as np
from numpy.lib.type_check import imag
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import collections, style
import csv




app = Flask(__name__)
app.config['SECRET_KEY'] = 'd770946afb62e547ecb834a6##'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


#---------------------------------------------------------------------------------------------------------------------------------------------------------------

# Best fit line creation
def best_fit_line(xs, ys):
    m = (((mean(xs)*mean(ys)) - mean(xs*ys)) / (mean(xs)*mean(xs) - mean(xs*xs)))
    b = mean(ys) - m*mean(xs)

    regression_line = []
    for x in xs:
        regression_line.append((m*x) + b)

    return regression_line

#------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        file = request.files['csvfile']
        if not os.path.isdir('static'):
            os.mkdir('static')
        filepath = os.path.join('static', file.filename)
        file.save(filepath)
        flash('The file name of the uploaded file is: {}'.format(file.filename), category='success')
        return redirect(url_for('dash'))
    return render_template('index.html')

@app.route('/dash', methods = ['GET', 'POST'])
def dash():
    if request.method == 'POST':
        X_axis = request.form['variable_X']
        Y_axis = request.form['variable_Y']
        data = pd.read_csv('static/data.csv')

        time_list = data[X_axis].astype(float)
        time_function = data[Y_axis].astype(float)
        regression_line = best_fit_line(xs=time_list, ys=time_function)

        newlist = []
        for h, w in zip(time_list, time_function):
            newlist.append({'x': h, 'y': w})
        ugly_blob = str(newlist).replace('\'', '')
        
        #plt.plot(data[variable])
        plt.scatter(time_list, time_function, color='#003F72')
        plt.plot(time_list, regression_line)
        plt.xlabel(X_axis)
        plt.ylabel(Y_axis)
        imagepath = os.path.join('static','image' + '.png')
        
        plt.savefig(imagepath) 
        return render_template('graph.html', image=imagepath, labels=time_list, regression_line=regression_line, data = newlist)
    return render_template('dash.html')


# @app.route('/data', methods=['GET', 'POST'])
# def data():
#     if request.method == 'POST':
#         # f = request.form['csvfile']
#         # data = []
#         # with open(f) as file:
#         #     csvfile = csv.reader(file)
#         #     for row in csvfile:
#         #         data.append(row)
#         # data = pd.DataFrame(data)
        
#         return render_template('data.html', data=data.to_html(header=False))


if __name__ == '__main__':
    app.run(debug=True)