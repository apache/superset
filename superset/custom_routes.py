from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from sqlalchemy.sql import text
from superset import db

custom_routes = Blueprint('custom_routes', __name__)

@custom_routes.route('/status-push', methods=['POST'])
def receive_sensor_data():
    data = request.json
    status_data = data.get('status_data')

    if not status_data:
        return jsonify({'status': 'error', 'message': 'status_data is required'}), 400

    sensor_info = status_data.get('sensor_info')
    states = status_data.get('states')

    if not sensor_info or not sensor_info.get('serial_number'):
        return jsonify({'status': 'error', 'message': 'serial_number is required'}), 400

    mac = sensor_info['serial_number']
    last_data_received_time = datetime.utcnow()

    # Convert Unix timestamp (in milliseconds) to datetime
    time_unix = sensor_info.get('time')
    time = datetime.fromtimestamp(time_unix / 1000, tz=timezone.utc) if time_unix else None

    # Insert or update device status
    device_update_query = text("""
        INSERT INTO device_data (mac, name, company, type, firmware, ip, status)
        VALUES (:mac, :name, :company, :type, :firmware, :ip, :status)
        ON CONFLICT (mac) 
        DO UPDATE SET 
            name = EXCLUDED.name,
            company = EXCLUDED.company,
            type = EXCLUDED.type,
            firmware = EXCLUDED.firmware,
            ip = EXCLUDED.ip,
            status = EXCLUDED.status;
    """)

    db.session.execute(device_update_query, {
        'mac': mac,
        'name': sensor_info.get('name'),
        'company': sensor_info.get('group'),
        'type': sensor_info.get('device_type'),
        'firmware': sensor_info.get('sw_version'),
        'ip': states.get('network', {}).get('state', {}).get('details', {}).get('ipv4', {}).get('address'),
        'status': 'ONLINE' if states.get('device', {}).get('state', {}).get('state') == 'OK' else 'OFFLINE'
    })

    db.session.commit()

    return jsonify({'status': 'success'}), 200


@custom_routes.route('/logic-push', methods=['POST'])
def receive_logic_push():
    try:
        logics_data = request.json.get('logics_data')
        if not logics_data:
            return jsonify({'status': 'error', 'message': 'logics_data is required'}), 400

        sensor_info = logics_data.get('sensor_info')
        if not sensor_info or not sensor_info.get('serial_number'):
            return jsonify({'status': 'error', 'message': 'serial_number is required'}), 400

        mac = sensor_info.get('serial_number')

        for logic in logics_data.get('logics', []):
            logic_name = logic.get('name')
            records = logic.get('records', [])

            for record in records:
                starttime = datetime.fromtimestamp(record.get('from') / 1000, timezone.utc)
                endtime = datetime.fromtimestamp(record.get('to') / 1000, timezone.utc)
                counts = record.get('counts', [])

                counts_data = {
                    'fw_enl_a': 0,
                    'fw_enl_c': 0,
                    'bw_enl_a': 0,
                    'bw_enl_c': 0,
                    'fw_exl_a': 0,
                    'fw_exl_c': 0,
                    'bw_exl_a': 0,
                    'bw_exl_c': 0,
                    'in_zl_a': 0,
                    'out_zl_a': 0,
                    'in_zl_c': 0,
                    'out_zl_c': 0
                }

                for count in counts:
                    count_name = count.get('name')
                    count_value = count.get('value', 0)

                    if logic_name == 'EXL-A':
                        if count_name == 'fw':
                            counts_data['fw_exl_a'] += count_value
                        elif count_name == 'bw':
                            counts_data['bw_exl_a'] += count_value
                    elif logic_name == 'ENL-A':
                        if count_name == 'fw':
                            counts_data['fw_enl_a'] += count_value
                        elif count_name == 'bw':
                            counts_data['bw_enl_a'] += count_value
                    elif logic_name == 'EXL-C':
                        if count_name == 'fw':
                            counts_data['fw_exl_c'] += count_value
                        elif count_name == 'bw':
                            counts_data['bw_exl_c'] += count_value
                    elif logic_name == 'ENL-C':
                        if count_name == 'fw':
                            counts_data['fw_enl_c'] += count_value
                        elif count_name == 'bw':
                            counts_data['bw_enl_c'] += count_value
                    elif logic_name == 'ZL-A':
                        if count_name == 'in':
                            counts_data['in_zl_a'] += count_value
                        elif count_name == 'out':
                            counts_data['out_zl_a'] += count_value
                    elif logic_name == 'ZL-C':
                        if count_name == 'in':
                            counts_data['in_zl_c'] += count_value
                        elif count_name == 'out':
                            counts_data['out_zl_c'] += count_value

                existing_time_slot_query = text("""
                    SELECT 1 FROM sensor_data 
                    WHERE mac = :mac AND starttime = :starttime AND endtime = :endtime
                """)
                existing_time_slot = db.session.execute(existing_time_slot_query, {
                    'mac': mac,
                    'starttime': starttime,
                    'endtime': endtime
                }).fetchone()

                if not existing_time_slot:
                    insert_query = text("""
                        INSERT INTO sensor_data (mac, starttime, endtime, fw_enl_a, fw_enl_c, bw_enl_a, bw_enl_c, fw_exl_a, fw_exl_c, bw_exl_a, bw_exl_c, in_zl_a, out_zl_a, in_zl_c, out_zl_c)
                        VALUES (:mac, :starttime, :endtime, :fw_enl_a, :fw_enl_c, :bw_enl_a, :bw_enl_c, :fw_exl_a, :fw_exl_c, :bw_exl_a, :bw_exl_c, :in_zl_a, :out_zl_a, :in_zl_c, :out_zl_c)
                    """)
                    db.session.execute(insert_query, {
                        'mac': mac,
                        'starttime': starttime,
                        'endtime': endtime,
                        'fw_enl_a': counts_data['fw_enl_a'],
                        'fw_enl_c': counts_data['fw_enl_c'],
                        'bw_enl_a': counts_data['bw_enl_a'],
                        'bw_enl_c': counts_data['bw_enl_c'],
                        'fw_exl_a': counts_data['fw_exl_a'],
                        'fw_exl_c': counts_data['fw_exl_c'],
                        'bw_exl_a': counts_data['bw_exl_a'],
                        'bw_exl_c': counts_data['bw_exl_c'],
                        'in_zl_a': counts_data['in_zl_a'],
                        'out_zl_a': counts_data['out_zl_a'],
                        'in_zl_c': counts_data['in_zl_c'],
                        'out_zl_c': counts_data['out_zl_c']
                    })
                    db.session.commit()
                else:
                    update_query = text("""
                        UPDATE sensor_data
                        SET fw_enl_a = COALESCE(fw_enl_a, 0) + :fw_enl_a,
                            fw_enl_c = COALESCE(fw_enl_c, 0) + :fw_enl_c,
                            bw_enl_a = COALESCE(bw_enl_a, 0) + :bw_enl_a,
                            bw_enl_c = COALESCE(bw_enl_c, 0) + :bw_enl_c,
                            fw_exl_a = COALESCE(fw_exl_a, 0) + :fw_exl_a,
                            fw_exl_c = COALESCE(fw_exl_c, 0) + :fw_exl_c,
                            bw_exl_a = COALESCE(bw_exl_a, 0) + :bw_exl_a,
                            bw_exl_c = COALESCE(bw_exl_c, 0) + :bw_exl_c,
                            in_zl_a = COALESCE(in_zl_a, 0) + :in_zl_a,
                            out_zl_a = COALESCE(out_zl_a, 0) + :out_zl_a,
                            in_zl_c = COALESCE(in_zl_c, 0) + :in_zl_c,
                            out_zl_c = COALESCE(out_zl_c, 0) + :out_zl_c
                        WHERE mac = :mac AND starttime = :starttime AND endtime = :endtime
                    """)
                    db.session.execute(update_query, {
                        'mac': mac,
                        'starttime': starttime,
                        'endtime': endtime,
                        'fw_enl_a': counts_data['fw_enl_a'],
                        'fw_enl_c': counts_data['fw_enl_c'],
                        'bw_enl_a': counts_data['bw_enl_a'],
                        'bw_enl_c': counts_data['bw_enl_c'],
                        'fw_exl_a': counts_data['fw_exl_a'],
                        'fw_exl_c': counts_data['fw_exl_c'],
                        'bw_exl_a': counts_data['bw_exl_a'],
                        'bw_exl_c': counts_data['bw_exl_c'],
                        'in_zl_a': counts_data['in_zl_a'],
                        'out_zl_a': counts_data['out_zl_a'],
                        'in_zl_c': counts_data['in_zl_c'],
                        'out_zl_c': counts_data['out_zl_c']
                    })
                    db.session.commit()

                cleanup_query = text("""
                    DELETE FROM sensor_data
                    WHERE mac = :mac AND starttime = :starttime AND endtime = :endtime
                    AND fw_enl_a = 0 AND fw_enl_c = 0 AND bw_enl_a = 0 AND bw_enl_c = 0
                    AND fw_exl_a = 0 AND fw_exl_c = 0 AND bw_exl_a = 0 AND bw_exl_c = 0
                    AND in_zl_a = 0 AND out_zl_a = 0 AND in_zl_c = 0 AND out_zl_c = 0
                """)
                db.session.execute(cleanup_query, {
                    'mac': mac,
                    'starttime': starttime,
                    'endtime': endtime
                })
                db.session.commit()

        return jsonify({'status': 'success'}), 200

    except Exception as e:
        print(f'Error saving logic and data: {e}')
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Error saving logic and data'}), 500

@custom_routes.route('/xp-logic-push', methods=['POST'])
def receive_xp_logic_push():
    try:
        if request.path != '/xp-logic-push':
            return jsonify({'status': 'error', 'message': 'Not Found'}), 404

        logics_data = request.json.get('logics_data')
        if not logics_data:
            return jsonify({'status': 'error', 'message': 'logics_data is required'}), 400

        sensor_info = logics_data.get('sensor_info')
        if not sensor_info or not sensor_info.get('serial_number'):
            return jsonify({'status': 'error', 'message': 'serial_number is required'}), 400

        mac = sensor_info.get('serial_number')

        def map_logic_name(original_name):
            if original_name == '0-adult':
                return 'ENL-A'
            elif original_name == '3-child':
                return 'ENL-C'
            elif original_name == '1-adult':
                return 'EXL-A'
            elif original_name == '4-child':
                return 'EXL-C'
            else:
                return original_name

        for logic in logics_data.get('logics', []):
            mapped_logic_name = map_logic_name(logic.get('name'))
            records = logic.get('records', [])

            for record in records:
                starttime = datetime.fromtimestamp(record.get('from') / 1000, timezone.utc)
                endtime = datetime.fromtimestamp(record.get('to') / 1000, timezone.utc)
                counts = record.get('counts', [])

                counts_data = {
                    'fw_enl_a': 0,
                    'fw_enl_c': 0,
                    'bw_enl_a': 0,
                    'bw_enl_c': 0,
                    'fw_exl_a': 0,
                    'fw_exl_c': 0,
                    'bw_exl_a': 0,
                    'bw_exl_c': 0,
                    'in_zl_a': 0,
                    'out_zl_a': 0,
                    'in_zl_c': 0,
                    'out_zl_c': 0
                }

                for count in counts:
                    count_name = count.get('name')
                    count_value = count.get('value', 0)

                    if mapped_logic_name == 'EXL-A':
                        if count_name == 'fw':
                            counts_data['fw_exl_a'] += count_value
                        elif count_name == 'bw':
                            counts_data['bw_exl_a'] += count_value
                    elif mapped_logic_name == 'ENL-A':
                        if count_name == 'fw':
                            counts_data['fw_enl_a'] += count_value
                        elif count_name == 'bw':
                            counts_data['bw_enl_a'] += count_value
                    elif mapped_logic_name == 'EXL-C':
                        if count_name == 'fw':
                            counts_data['fw_exl_c'] += count_value
                        elif count_name == 'bw':
                            counts_data['bw_exl_c'] += count_value
                    elif mapped_logic_name == 'ENL-C':
                        if count_name == 'fw':
                            counts_data['fw_enl_c'] += count_value
                        elif count_name == 'bw':
                            counts_data['bw_enl_c'] += count_value
                    elif mapped_logic_name == 'ZL-A':
                        if count_name == 'in':
                            counts_data['in_zl_a'] += count_value
                        elif count_name == 'out':
                            counts_data['out_zl_a'] += count_value
                    elif mapped_logic_name == 'ZL-C':
                        if count_name == 'in':
                            counts_data['in_zl_c'] += count_value
                        elif count_name == 'out':
                            counts_data['out_zl_c'] += count_value

                # Define the table name dynamically
                table_name = f"sensor_data_{mac.replace('-', '_')}"

                # Create table if not exists
                create_table_query = text(f"""
                    CREATE TABLE IF NOT EXISTS {table_name} (
                        mac TEXT,
                        starttime TIMESTAMPTZ,
                        endtime TIMESTAMPTZ,
                        fw_enl_a INTEGER DEFAULT 0,
                        fw_enl_c INTEGER DEFAULT 0,
                        bw_enl_a INTEGER DEFAULT 0,
                        bw_enl_c INTEGER DEFAULT 0,
                        fw_exl_a INTEGER DEFAULT 0,
                        fw_exl_c INTEGER DEFAULT 0,
                        bw_exl_a INTEGER DEFAULT 0,
                        bw_exl_c INTEGER DEFAULT 0,
                        in_zl_a INTEGER DEFAULT 0,
                        out_zl_a INTEGER DEFAULT 0,
                        in_zl_c INTEGER DEFAULT 0,
                        out_zl_c INTEGER DEFAULT 0,
                        PRIMARY KEY (mac, starttime, endtime)
                    )
                """)
                db.session.execute(create_table_query)
                db.session.commit()

                # Insert or update data
                upsert_query = text(f"""
                    INSERT INTO {table_name} (mac, starttime, endtime, fw_enl_a, fw_enl_c, bw_enl_a, bw_enl_c, fw_exl_a, fw_exl_c, bw_exl_a, bw_exl_c, in_zl_a, out_zl_a, in_zl_c, out_zl_c)
                    VALUES (:mac, :starttime, :endtime, :fw_enl_a, :fw_enl_c, :bw_enl_a, :bw_enl_c, :fw_exl_a, :fw_exl_c, :bw_exl_a, :bw_exl_c, :in_zl_a, :out_zl_a, :in_zl_c, :out_zl_c)
                    ON CONFLICT (mac, starttime, endtime)
                    DO UPDATE SET
                        fw_enl_a = sensor_data_{mac.replace('-', '_')}.fw_enl_a + EXCLUDED.fw_enl_a,
                        fw_enl_c = sensor_data_{mac.replace('-', '_')}.fw_enl_c + EXCLUDED.fw_enl_c,
                        bw_enl_a = sensor_data_{mac.replace('-', '_')}.bw_enl_a + EXCLUDED.bw_enl_a,
                        bw_enl_c = sensor_data_{mac.replace('-', '_')}.bw_enl_c + EXCLUDED.bw_enl_c,
                        fw_exl_a = sensor_data_{mac.replace('-', '_')}.fw_exl_a + EXCLUDED.fw_exl_a,
                        fw_exl_c = sensor_data_{mac.replace('-', '_')}.fw_exl_c + EXCLUDED.fw_exl_c,
                        bw_exl_a = sensor_data_{mac.replace('-', '_')}.bw_exl_a + EXCLUDED.bw_exl_a,
                        bw_exl_c = sensor_data_{mac.replace('-', '_')}.bw_exl_c + EXCLUDED.bw_exl_c,
                        in_zl_a = sensor_data_{mac.replace('-', '_')}.in_zl_a + EXCLUDED.in_zl_a,
                        out_zl_a = sensor_data_{mac.replace('-', '_')}.out_zl_a + EXCLUDED.out_zl_a,
                        in_zl_c = sensor_data_{mac.replace('-', '_')}.in_zl_c + EXCLUDED.in_zl_c,
                        out_zl_c = sensor_data_{mac.replace('-', '_')}.out_zl_c + EXCLUDED.out_zl_c
                """)
                db.session.execute(upsert_query, {
                    'mac': mac,
                    'starttime': starttime,
                    'endtime': endtime,
                    'fw_enl_a': counts_data['fw_enl_a'],
                    'fw_enl_c': counts_data['fw_enl_c'],
                    'bw_enl_a': counts_data['bw_enl_a'],
                    'bw_enl_c': counts_data['bw_enl_c'],
                    'fw_exl_a': counts_data['fw_exl_a'],
                    'fw_exl_c': counts_data['fw_exl_c'],
                    'bw_exl_a': counts_data['bw_exl_a'],
                    'bw_exl_c': counts_data['bw_exl_c'],
                    'in_zl_a': counts_data['in_zl_a'],
                    'out_zl_a': counts_data['out_zl_a'],
                    'in_zl_c': counts_data['in_zl_c'],
                    'out_zl_c': counts_data['out_zl_c']
                })
                db.session.commit()

        return jsonify({'status': 'success'}), 200

    except Exception as e:
        print(f'Error saving logic and data: {e}')
        db.session.rollback()
        return jsonify({'status': 'error', 'message': 'Error saving logic and data'}), 500