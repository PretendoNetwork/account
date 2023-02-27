#!/bin/sh

# this doesnt check game server specific certs, only static file paths
files='config.json'

for file in $files; do
    if [ ! -f $file ]; then
        echo "$PWD/$file file does not exist. Please mount and try again."
        exit 1
    fi
done

# check for keys
keys='certs/nex/datastore/secret.key certs/service/account/secret.key certs/service/account/aes.key certs/service/account/private.pem certs/service/account/public.pem'
for file in $keys; do
    if [ ! -f "$file" ]; then
        if [ x"${GENERATE_NEW_KEYS}" = "x" ]; then
            echo "$PWD/$file file does not exist. Please mount and try again."
            exit 1
        else
            echo "$PWD/$file file does not exist. Generating a temporary one"
            node generate-keys.js nex datastore
            node generate-keys.js account
        fi
    fi
done

exec node src/server.js
