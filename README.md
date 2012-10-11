Easy Maths
=========

Web App to learn the four basic operations.

The project is based on NodeJS and MongoDB.

In order to run:

    git clone <repository url>
    cd easymaths
    node app.js

The login is based on Twitter, so you need to create an App, get Consumer Key and Secret and adjust the callback url into `app.js` to make it work.

The app looks for MongoDB on localhost, on default port (27017). Change the lines of MongoDB into `app.js` to configure it.