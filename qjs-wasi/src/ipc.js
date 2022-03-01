import * as host from 'host';
import * as os from 'os';

let id = 0;
const handlers = {};
const resolves = {};
const rejects = {};
export function register(methodName, handler) {
  handlers[methodName] = handler;
}
export function invoke(method) {
  const params = Array.from(arguments).slice(1);
  return new Promise(function (resolve, reject) {
    const rpccall = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++id,
    };
    resolves[rpccall.id] = resolve;
    rejects[rpccall.id] = reject;
    host.writeLine(JSON.stringify(rpccall));
  });
}
function unitOfWork() {
  const line = host.readLine();
  if (line == null || line=='') {
    return true;
  }
  if (line == '.quit') {
    return false;
  }

  let data = JSON.parse(line);

  if (data.method) {
    const func = handlers[data.method];
    if (typeof func == 'function' && Array.isArray(data.params)) {
      try {
        const promiseOrValue = func.apply(null, data.params);
        if (promiseOrValue && promiseOrValue.constructor === Promise) {
          promiseOrValue.then(
            function(result) {
              host.writeLine(JSON.stringify({
                jsonrpc: '2.0',
                result,
                id: data.id
              }));
            }, 
            function(error) {
              host.writeLine(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32603,
                  message: 'Internal error: ' + error,
                  data: error
                },
                id: data.id
              }));
            }
          );
        }
        else {
          host.writeLine(JSON.stringify({
            jsonrpc: '2.0',
            result: promiseOrValue,
            id: data.id
          }));
        }
      }
      catch(ex){
        host.writeLine(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error:' + ex,
            data: ex
          },
          id: data.id
        }));
      }
    }
  }
  else if (data.result) {
    resolves[data.id](data.result);
    delete resolves[data.id];
    delete rejects[data.id];
  }
  else if (data.error) {
    rejects[data.id](data.error);
    delete resolves[data.id];
    delete rejects[data.id];
  }
  return true;
}
export function listen() {
  if (unitOfWork()) {
    os.setTimeout(function () {
      listen();
    }, 0);
  }
}