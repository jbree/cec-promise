var Promise = require('promise');
const NodeCecModule = require('node-cec');
const NodeCec = NodeCecModule.NodeCec;
const CEC = NodeCecModule.CEC;

let client = new NodeCec('node-cec-monitor');
let responsesPending = [];
let timeout = 1000;

let ready = new Promise(function (resolve, reject) {
  let errorTimeout = setTimeout(function () {
    reject(new Error('cec-client never reported ready'));
  }, 5000);

  client.once('ready', function (client) {
    resolve(client);
  });

  client.start('cec-client', '-m', '-d', '8', '-b', 'r');
});

let request = function (dest, command, response) {
  return new Promise(function(resolve, reject) {

    ready
    .then(function () {
      let timer;
      client.once(response, function (packet, status) {
        // console.log(`resolving response ${responsesPending[response]}`);
        clearTimeout(timer);
        responsesPending[response]--;
        resolve({packet: packet, status: status});
      });

      if (!(response in responsesPending)) {
        responsesPending[response] = 1;
        // console.log(`first request for ${response}`);
        client.sendCommand(dest, CEC.Opcode[command]);
      } else {
        responsesPending[response]++;
        // console.log(`${responsesPending[response]} requests for ${response}`);
      }

      timer = setTimeout(reject, timeout, new Error(`No ${response} received after ${timeout}ms`));
    })
    .catch(function (err) {
      // console.log(err);
      reject(err);
    });

  });
};

let send = function (command) {
  ready
  .then(function () {
    client.send(command);
  })
  .catch(function (err) {
    reject(err);
  });
};

let command = function (dest, command) {
  ready
  .then(function () {
    client.sendCommand(dest, command);
  })
  .catch(function (err) {
    reject(err);
  });
};

module.exports = {
  command: command,
  send: send,
  timeout: timeout,
  request: request,
  code: CEC
};
