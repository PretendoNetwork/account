# Account-Server

Contains a replacement for https://account.nintendo.net, https://nasc.nintendowifi.net aswell as an API-Serivce for account details.

You are required to use a MongoDB Server.


Setting up:
---
_____

1. Clone / Download this repository onto your server.
2. Run `npm i` to install all packages.
3. Enter the src-directory and copy the `example.config.json` to `config.json`. You can also use the .env file with environment variables.
4. Edit your preffered configuration method of choice. Here you mainly need to enter your MongoDB connection details.
5. When done, you may try to run your instance by executing `node server.js` in the `src` folder.
6. Also, try to run the `create-test-user.js` script. This will create a new "NNID" Account. If it finished with "New user created" your instance is ready!

Please notice that you will have to use subdomains in order to make use out of this. You can use a reverse proxy like HAProxy or Traefik for this purpose.
