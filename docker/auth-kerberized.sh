#!/usr/bin/env bash
    
principalKey=`klist -tke /etc/security/keytabs/$HIVE_KEYTAB_NAME | grep '@' | awk -F' ' '{print $4}'|head -1`
kinit -kt /etc/security/keytabs/$HIVE_KEYTAB_NAME $principalKey