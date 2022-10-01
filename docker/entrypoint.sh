#!/bin/sh

# this doesnt check game server specific certs, only static file paths
files='config.json certs/nex/datastore/secret.key certs/service/account/secret.key certs/service/account/aes.key certs/service/account/private.pem certs/service/account/public.pem'

for file in $files; do
    if [ ! -f $file ]; then
        echo "$PWD/$file file does not exist. Please mount and try again."
        exit 1
    fi
done

exec node src/server.js
