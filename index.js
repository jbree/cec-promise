"use strict";

var Promise = require('promise');
const NodeCecModule = require('node-cec');
const NodeCec = NodeCecModule.NodeCec;
const CEC = NodeCecModule.CEC;
const startupTimeout = 30000; // milliseconds

let client = new NodeCec('node-cec-monitor');
let timeout = 3000;
let busy = false;

let ready = new Promise(function (resolve, reject) {
  let errorTimeout = setTimeout(function () {
    reject(new Error('cec-client never reported ready'));
  }, startupTimeout);
  client.once('ready', function (client) {
    clearTimeout(errorTimeout);
    setTimeout(function () {
      resolve(client);
    }, 3000);
  });

  client.start('cec-client', '-m', '-d', '8', '-b', 'r');

  process.on('exit', client.stop);
});

let request = function (dest, command, response) {
  const requestDestinationAddress = dest % 16;

  return new Promise(function(resolve, reject) {
    ready
    .then(function () {
      let errorTimer;

      let processResponse = function(packet, status) {
        const responseSourceAddress = parseInt(packet.source, 16);

        if (responseSourceAddress === requestDestinationAddress) {
          client.removeListener(response, processResponse);
          clearTimeout(errorTimer);
          resolve({packet: packet, status: status});
        }
      };

      client.on(response, processResponse);

      const sendWhenAble = function() {
        if (busy) {
          setTimeout(sendWhenAble, 100);
        } else {
          busy = true;
          client.sendCommand(dest, CEC.Opcode[command]);
          setTimeout(function () { busy = false; }, 200);
        }
      };
      sendWhenAble();

      errorTimer = setTimeout(function () {
        client.removeListener(response, processResponse);
        return reject(new Error(`No ${response} received after ${timeout}ms`));
      }, timeout);
    })
    .catch(function (err) {
      reject(err);
    });

  });
};

let send = function (command) {
  ready
  .then(function () {
    client.send(command);
    resolve();
  })
  .catch(function (err) {
    reject(err);
  });
};

let command = function (dest, command) {
  ready
  .then(function () {
    client.sendCommand(dest, command);
    resolve();
  })
  .catch(function (err) {
    reject(err);
  });
};

let on = client.on.bind(client);

let once = client.once.bind(client);

module.exports = {
  command: command,
  on: on,
  once: once,
  request: request,
  send: send,
  timeout: timeout,
  code: CEC
};
