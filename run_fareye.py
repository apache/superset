from superset import create_app

if __name__ == '__main__':
    app = create_app()
    app.run(host="localhost", port=8080, debug=True)
