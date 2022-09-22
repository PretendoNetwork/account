# Account-Server

Replacement for https://account.nintendo.net

Requires a S3-compatible storage (e.g. MinIO (free)) aswell as a MongoDB server.


Setting up:
---
_____

1. Clone / Download this repository onto your server.
2. Run `npm i` to install all packages.
3. Enter the src-directory and copy the `example.config.json` and `example.servers.json` to `config.json` and `servers.json` respectively.
4. Go ahead and edit `config.json`. Here you mainly need to enter your S3-Storage instance credentials aswell as your MongoDB connection.
5. When done, you may try to run your instance by executing `node server.js` in the `src` folder.
6. Also, try to run the `create-test-user.js` script. This will create a new "NNID" Account and will need both MongoDB and S3-Storage. If it finished with "New user created" your instance is ready!

Please notice that you will have to use subdomains in order to make use out of this.
