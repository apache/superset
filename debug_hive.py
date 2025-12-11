import socket
import sys

host = 'hive-server'
port = 10000

print(f"Testing connectivity to {host}:{port}...")

# Test 1: DNS Resolution
try:
    ip = socket.gethostbyname(host)
    print(f"DNS Resolved: {host} -> {ip}")
except Exception as e:
    print(f"DNS Failed: {e}")
    sys.exit(1)

# Test 2: TCP Socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((ip, port))
    print(f"TCP Connection Successful to {ip}:{port}")
    s.close()
except Exception as e:
    print(f"TCP Connection Failed: {e}")
    # sys.exit(1) # Continue to try PyHive if TCP fails? No, PyHive will definitely fail.
    
# Test 3: PyHive Connection (Minimal)
print("Testing PyHive Connection...")
try:
    from pyhive import hive
    conn = hive.Connection(host=host, port=port, username='hive', auth='NOSASL') # Try NOSASL first
    print("PyHive Connection (NOSASL): SUCCESS")
    conn.close()
except Exception as e:
    print(f"PyHive Connection (NOSASL) Failed: {e}")
    
try:
    from pyhive import hive
    conn = hive.Connection(host=host, port=port, username='hive') # Default auth
    print("PyHive Connection (Default): SUCCESS")
    conn.close()
except Exception as e:
    print(f"PyHive Connection (Default) Failed: {e}")
