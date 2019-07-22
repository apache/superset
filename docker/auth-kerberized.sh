#!/usr/bin/env bash
    
principalKey=`klist -tke /etc/security/keytabs/$superset_hive_keytab_name | grep '@' | awk -F' ' '{print $4}'|head -1`
kinit -kt /etc/security/keytabs/$superset_hive_keytab_name $principalKey