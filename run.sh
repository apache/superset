# Create an admin user in your metadata database (use `admin` as username to be able to load the examples)
export PYTHONPATH=$(pwd)/superset
export FLASK_APP=superset
export SUPERSET_CONFIG_PATH=$(pwd)/superset/_superset_config.py

# superset db upgrade

# superset fab create-admin

# Load some data to play with
# superset load_examples

# Create default roles and permissions
# superset init

# cp "${pwd}/assets/images/favicon.png" "${pwd}/assets/images/favicon.png"

# To start a development web server on port 8088, use -p to bind to another port
superset run -h 0.0.0.0 -p 8088 --with-threads --reload --debugger

# Add Port Forwarding Rule
# netsh interface portproxy add v4tov4 listenport=8088 listenaddress=0.0.0.0 connectport=8088 connectaddress=172.22.145.80.

# (Optional) Configure Firewall
# netsh advfirewall firewall add rule name="WSL 8088 Forwarding" protocol=TCP dir=in localport=8088 8088=allow

# Delete
# netsh interface portproxy delete v4tov4 listenport=8088 listenaddress=0.0.0.0
# netsh advfirewall firewall delete rule name="WSL 8088 Forwarding"


