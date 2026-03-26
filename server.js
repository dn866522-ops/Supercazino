const express = require('express');
const server = express();

server.all('/', (req, res) => {
    res.send('Men uyg'oqman!');
});

function keepAlive() {
    server.listen(3000, () => {
        console.log("Server tayyor!");
    });
}

module.exports = keepAlive;
