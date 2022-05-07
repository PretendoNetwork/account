#!/bin/sh

files='config.json certs/nex/datastore/secret.key certs/nex/secret.key certs/nex/public.pem'

for file in $files; do
    if [ ! -f $file ]; then
        echo "$PWD/$file file does not exist. Please mount and try again."
        exit 1
    fi
done

exec node src/server.js
