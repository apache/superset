import subprocess
cmd = 'docker volume ls | grep -v -e superset_db_home | tr -d " \t" | sed -E -e "s/local|DRIVER.*//"'
out = subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip('\n')
print(' '.join(out.split('\n')).strip())