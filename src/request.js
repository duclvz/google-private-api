var _ = require("lodash");
var Promise = require("bluebird");
var request = require("request-promise");
var ProxyAgent = require("proxy-agent");

function Request(session) {
  this._id = _.uniqueId();
  this._url = null;
  this._request = {};
  this._request.method = 'GET';
  this._request.headers = {};
  this._request.options = {};
  this.attemps = 2;
  this.session = session;
  this._initialize.apply(this, arguments);
}

module.exports = Request;

var Device = require('./device');
var Helpers = require('../helpers');
var Session = require('./session');

Request.requestClient = request.defaults({});

Request.jar = function (store) {
    return request.jar(store);
}

Request.setTimeout = function (ms) {
    var object = { 'timeout': parseInt(ms) };
    Request.requestClient = request.defaults(object);
}

Request.setProxy = function (proxyUrl) {
    if(!Helpers.isValidUrl(proxyUrl))
        throw new Error("`proxyUrl` argument is not an valid url")
    var object = { agent: new ProxyAgent(proxyUrl) };
    Request.requestClient = request.defaults(object);
}

Object.defineProperty(Request.prototype, "session", {
  get: function () {
    return this._session
  },

  set: function (session) {
    this.setSession(session);
  }
});

Object.defineProperty(Request.prototype, "device", {
  get: function () {
    return this._device
  },

  set: function (device) {
    this.setDevice(device);
  }
});

Object.defineProperty(Request.prototype, "url", {
  get: function () {
    return this._url
  },

  set: function (url) {
    this.setUrl(url);
  }
});


Request.prototype._initialize = function() {
  // Easier for inheritence
};


Request.prototype.setOptions = function (options, override) {
  if (options.method) {
    this.setMethod(options.method);
    delete options.method;
  }
  if (options.url) {
    this.setUrl(options.url);
    delete options.url;
  }
  if (options.headers) {
    this.setHeaders(options.headers);
    delete options.headers;
  }
  this._request.options = override === false ? _.defaults(this._request.options, options || {}) : _.assignIn(this._request.options, options || {});
  return this;
};

Request.prototype.setMethod = function (method) {
  method = method.toUpperCase();
  if (!_.includes(['POST', 'GET', 'PATCH', 'PUT', 'DELETE'], method))
    throw new Error("Method `" + method + "` is not valid method");
  this._request.method = method;
  return this;
};

Request.prototype.setUrl = function (url) {
  if (!_.isString(url) || !Helpers.isValidUrl(url))
    throw new Error("The `url` parameter must be valid url string");
  this._url = url;
  if (url.indexOf('youtube.com') > -1)
    this.setHeaders({
      'User-Agent': this.device.userAgentDesktop()
    });
  return this;
};

Request.prototype.setHeaders = function (headers) {
  this._request.headers = _.assignIn(this._request.headers, headers || {});
  return this;
};

Request.prototype.removeHeader = function (name) {
  delete this._request.headers[name];
  return this;
};

Request.prototype.setDevice = function (device) {
  if (!(device instanceof Device))
    throw new Error("`device` parametr must be instance of `Device`")
  this._device = device;
  this.setHeaders({
    'User-Agent': device.userAgent()
  });
  return this;
};

Request.prototype.setSession = function (session) {
  if (!(session instanceof Session))
    throw new Error("`session` parameter must be instance of `Session`")
  this._session = session;
  if (session.device)
    this.setDevice(session.device);
  if (session.proxyUrl)
    this.setOptions({ agent: new ProxyAgent(session.proxyUrl) });
  this.setOptions({ jar: session.jar });
  return this;
};

Request.prototype._mergeOptions = function (options) {
  var opts = _.defaultsDeep({
    method: this._request.method,
    url: this._url,
    headers: this._request.headers,
    resolveWithFullResponse: true
  }, options || {}, this._request.options);
  return Promise.resolve(opts);
};

Request.prototype.parseMiddleware = function (res) {
  if (Helpers.isValidJSONResponse(res) && res.body.slice(0, 4) === ")]}'")
    _.assignIn(res, { body: JSON.parse(res.body.slice(6)) });
  return Promise.resolve(res);
};

Request.prototype.send = function (options, attemps) {
  if (!attemps) attemps = 0;
  return this._mergeOptions(options)
    .then(Request.requestClient)
    .then(this.parseMiddleware)
    .catch(function (error) {
      console.log('Error ' + error + ' in Request');
    })
}
