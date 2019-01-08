var _ = require('lodash');
var Promise = require('bluebird');

function Session(device, storage, account, proxy) {
  this.account = _.cloneDeep(account);
  this.setDevice(device);
  this.setCookiesStorage(storage);
  if (_.isString(proxy) && !_.isEmpty(proxy))
    this.proxyUrl = proxy;
}

module.exports = Session;

Session.defaultHeaders = {
  'x-same-domain': '1',
  'google-accounts-xsrf': '1',
  'accept-language': 'en-US',
  'accept-encoding': 'utf-8',
  'accept': '*/*'
}

Session.defaultForm = {
  continue: 'https://accounts.google.com/ManageAccount',
  flowName: 'GlifWebSignIn',
  flowEntry: 'ServiceLogin',
  deviceinfo: '[null,null,null,[],null,"US",null,null,[],"GlifWebSignIn",null,[null,null,[],null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,[5,"77185425430.apps.googleusercontent.com",["https://www.google.com/accounts/OAuthLogin"],null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,5]]]',
  checkConnection: 'youtube:1542:1',
  checkedDomains: 'youtube',
  pstMsg: '1'
}

var Request = require("./request");
var CONSTANTS = require("./constants");
var Device = require("./device");
var Helpers = require("../helpers");

Object.defineProperty(Session.prototype, "jar", {
  get: function () { return this._jar },
  set: function (val) {}
});


Object.defineProperty(Session.prototype, "cookieStore", {
  get: function () { return this._cookiesStore },
  set: function (val) {}
});


Object.defineProperty(Session.prototype, "device", {
  get: function () { return this._device },
  set: function (val) {}
});

Object.defineProperty(Session.prototype, "proxyUrl", {
  get: function () {
    return this._proxyUrl;
  },
  set: function (val) {
    return this.setProxy(val);
  }
});

Session.prototype.setCookiesStorage = function (storage) {
  // if (!(storage instanceof CookieStorage))
  //   throw new Error("`storage` is not an valid instance of `CookieStorage`");
  this._cookiesStore = storage;
  this._jar = Request.jar(storage);
  return this;
};

Session.prototype.setDevice = function (device) {
  if (!(device instanceof Device))
    throw new Error("`device` is not an valid instance of `Device`");
  this._device = device;
  return this;
};

Session.prototype.setProxy = function (url) {
  if (!Helpers.isValidUrl(url) && url !== null)
    throw new Error("`proxyUrl` argument is not an valid url")
  this._proxyUrl = url;
  return this;
}

Session.prototype._resetreqid = function () {
  this.account._reqid = (Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000).toString();
  return this.account._reqid;
}

Session.prototype._nextreqid = function () {
  if (!this.account._reqid)
    return this._resetreqid();
  if (Number(this.account._reqid) > 99999)
    this.account._reqid = (Math.floor(Number(this.account._reqid) / 100000) + 1).toString() + (Number(this.account._reqid) % 100000).toString();
  return this.account._reqid;
}

Session.prototype.createRequest = function (opts) {
  var options = _.cloneDeep(opts);
  options.headers = _.assignIn(options.headers, Session.defaultHeaders);
  if (options.url && options.url.indexOf('_reqid') > -1)
    this._nextreqid();
  if (options.url)
    options.url = _.template(options.url)(this.account);
  if (options.headers && options.headers.referer)
    options.headers.referer = _.template(options.headers.referer)(this.account);
  if (options.form) {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    if (options.form['f.req'])
      options.form['f.req'] = _.template(options.form['f.req'])(this.account);
    if (options.form.TL)
      options.form.TL = this.account.TL;
    if (options.form.deviceAddress)
      options.form.deviceAddress = this.account.verifyPhone;
    if (options.form.deviceCountry)
      options.form.deviceCountry = this.account.verifyPhoneRegion;
    if (options.form.deliveryMethod)
      options.form.deliveryMethod = this.account.verifyPhoneMethod || options.form.deliveryMethod;
    if (options.form.smsUserPin)
      options.form.smsUserPin = this.account.verifyUserPin;
    _.assignIn(options.form, Session.defaultForm);
  }
  return new Request(this).setOptions(options);
}

Session.prototype.parseJSON = function (res) {
  switch (res.body[0][0][0]) {
  case 'gf.alr':
    if (res.body[0][0][1] == 1) {
      this.account.token = res.body[0][0][2];
      return res;
    }
    else throw new Error("lookup: Username is not available or not found!");
  case 'gf.sicr':
    if (res.body[0][0][3] == 5)
      throw new Error("challenge: " + res.body[0][0][5][2] + " - INCORRECT_ANSWER_ENTERED");
    if (res.body[0][0][3] == 2)
      throw new Error("challenge: Account temporary locked, check idvreenable");
    if (res.body[0][0][3] == 3) {
      this.account.challengeChoices = {};
      res.body[0][0][10][0].forEach(choice => {
        let data = { cid: choice[3], did: choice[8] };
        let type = choice[23]['1009'] ? 'smsCode:voiceCode' : choice[23]['1026'] ? 'recoveryPhone' : choice[23]['1027'] ? 'recoveryMail' : 'unknown';
        data.hint = choice[23]['1009'] ? choice[23]['1009'][0] : choice[23]['1026'] ? choice[23]['1026'][0][0] : choice[23]['1027'] ? choice[23]['1027'][0] : 'unknown';
        type.split(':').forEach(t => {
          this.account.challengeChoices[t] = data;
        })
      });
      this.account.TL = res.body[0][1][2];
      this.account.challengeSelection = (this.account.recoveryPhone && this.account.recoveryPhoneRegion) ? 'recoveryPhone' : this.account.recoveryMail ? 'recoveryMail' : null;
      if (!this.account.challengeSelection) throw new Error("There are no recovery info (phone & mail) provided!")
      return res;
    }
    if (res.body[0][0][3] == 1) {
      return res;
    }
    return res;
  case 'gf.siscr':
    this.account.TL = res.body[0][1][2];
    return res;
  case 'er':
    console.log(res.body)
    throw new Error('Error response JSON');
  default:
    throw new Error("Not valid JSON Response");
  }
}

Session.prototype.login = function () {
  return this.createRequest(CONSTANTS.REQUESTS.accounts).send()
    .then(res => this.createRequest(CONSTANTS.REQUESTS.lookup).send().then(this.parseJSON.bind(this)))
    .then(res => this.createRequest(CONSTANTS.REQUESTS.challenge).send().then(this.parseJSON.bind(this)))
    .then(res => {
      if (res.body[0][0][3] == 3) {
        return this.createRequest(CONSTANTS.REQUESTS.selectChallenge).send().then(this.parseJSON.bind(this))
          .then(res => {
            return this.createRequest(CONSTANTS.REQUESTS.challengeVerify).send().then(this.parseJSON.bind(this));
          });
      }
      else return res;
    })
    .then(res => this.createRequest(CONSTANTS.REQUESTS.checkCookie).setOptions({ url: res.body[0][0][13][2] }).send())
    .then(res => {
      let urlSID = res.body.split(/uri: '(.+?)',/).filter(function (x) { return x.indexOf('https') == 0 && x.indexOf('SID') > -1 });
      return Promise.all(urlSID.map(SID => {
        return this.createRequest(CONSTANTS.REQUESTS.setSID).setOptions({ url: SID.replace(/\\x.{2}/g, x => String.fromCharCode('0' + x.slice(1))) }).send();
      }))
    })
}

Session.prototype.getChannels = function () {
  return this.createRequest(CONSTANTS.REQUESTS.ytAccount).send()
    .then(res => this.createRequest(CONSTANTS.REQUESTS.channelSwitcher).send())
    .then(res => {
      let pages = res.body.split(/<li\sclass="channel-switcher-button(.*?)">((.|\n)*?)<\/li>/)
        .filter(x => x.indexOf('page-info') > -1)
        .map(x => {
          let subs = x.split(/page-info-text">((.|\n)+?)subscribers/)[1];
          subs = subs ? Number(subs.replace(/[,\n\s]/g, '')) : undefined;
          return {
            switchurl: 'https://www.youtube.com' + x.split(/href="(.+?)"/)[1],
            name: x.split(/page-info-name">((.|\n)*?)</)[1].trim(),
            img: x.split(/src="(.+?)"/)[1],
            subs: subs,
            pageid: x.split(/pageid=("*)(\d+)/)[2],
          };
        });
      return pages;
    })
    .then(async pages => {
      let channels = pages.filter(x => typeof x.subs === 'number');
      for (let channel of channels) {
        await this.createRequest({ method: 'GET', url: channel.switchurl, simple: false }).send().catch(() => {});
        // Change Language to English
        let picker = await this.createRequest(CONSTANTS.REQUESTS.listLanguage).send().catch(() => { return { body: '' } });
        await this.createRequest(CONSTANTS.REQUESTS.pickLanguage).setOptions({ form: { base_url: 'https://www.youtube.com/', hl: 'en', session_token: picker.body.split(/session_token(.*?)value=\\"(.+?)\\"/)[2] } }).send().catch(() => {});
        // Get Channel Info
        let dashboard = await this.createRequest(CONSTANTS.REQUESTS.ytDashboard).send().catch(() => { return { body: '' } });
        let features = await this.createRequest(CONSTANTS.REQUESTS.ytFeatures).send().catch(() => { return { body: '' } });

        channel.channelurl = dashboard.body.split(/dashboard-channel-link(.+?)(\/(.|\n)+?)"/)[2];
        channel.channelid = features.body.split(/\/channel\/(.+?)"((.|\n)*?)yt-user-photo/)[1];
        channel.verified = features.body.match(/account-status-verified/) ? true : false;
        channel.upload = features.body.split(/account-features-v2-upload(.*?)title="(.+?)"/)[2];
        channel.monetization = features.body.split(/account-features-v2-monetization(.*?)title="(.+?)"/)[2];
        channel.liveevents = features.body.split(/account-features-v2-live-events(.*?)title="(.+?)"/)[2];
        channel.embedliveevents = features.body.split(/account-features-v2-embed-live-events(.*?)title="(.+?)"/)[2];
        channel.unlimiteduploads = features.body.split(/account-features-v2-unlimited-uploads(.*?)title="(.+?)"/)[2];
        channel.unlistedvideos = features.body.split(/account-features-v2-unlisted-videos(.*?)title="(.+?)"/)[2];
        channel.customthumbs = features.body.split(/account-features-v2-custom-thumbs(.*?)title="(.+?)"/)[2];
        channel.externalannotations = features.body.split(/account-features-v2-external-annotations(.*?)title="(.+?)"/)[2];
        channel.buybucket = features.body.split(/account-features-v2-buybucket(.*?)title="(.+?)"/)[2];
        channel.customurl = features.body.split(/account-features-v2-custom-url(.*?)title="(.+?)"/)[2];
        channel.cidappeals = features.body.split(/account-features-v2-cid-appeals(.*?)title="(.+?)"/)[2];
        channel.sponsors = features.body.split(/account-features-v2-sponsors(.*?)title="(.+?)"/)[2];

        let monetization = channel.monetization !== 'Disabled' && channel.monetization !== 'Enabled' ? await this.createRequest(CONSTANTS.REQUESTS.ytMonetization).send().catch(() => { return { body: '' } }) : { body: '' };
        channel.threestep = channel.monetization !== 'Disabled' && channel.monetization !== 'Enabled' && !monetization.body.split(/<div class="ypp-monetization-step">/)[4];
        let adsense = channel.monetization === 'Enabled' ? await this.createRequest(CONSTANTS.REQUESTS.ytAdsene).send().catch(() => { return { body: '' } }) : { body: '' };
        channel.adsenseid = adsense.body.split(/Adsense Id(.+?)value">(.+?)</)[2];
        channel.adsensedate = adsense.body.split(/Date Associated(.+?)value">(.+?)</)[2];
      }
      return channels;
    })
}

Session.prototype.verifyIG = function () {
  // Check Mail, search mail IG verify
  return this.createRequest({
      method: 'GET',
      url: 'https://mail.google.com/mail/?ui=html'
    }).send().then(res => {
      let basicurl = 'https://mail.google.com/mail/?ui=html';
      let at = res.body.split(/name="at"(.+?)value="(.+?)"/)[2];
      return this.createRequest({
        method: 'POST',
        url: basicurl,
        headers: {
          referer: 'https://mail.google.com/mail/'
        },
        form: {
          at: at
        },
        followAllRedirects: true,
      }).send();
    }).then(res => {
      let baseurl = res.body.split(/base href="(.+?)"/)[1];
      let nvp_site_mail = res.body.split(/nvp_site_mail(.+?)value="(.+?)"/)[2];
      let at = res.body.split(/name="at"(.+?)value="(.+?)"/)[2];
      return this.createRequest({
        method: 'POST',
        url: encodeURI(baseurl + '?s=q&q=registrations@mail.instagram.com&nvp_site_mail=' + nvp_site_mail),
        form: {
          s: 'q',
          q: 'registrations@mail.instagram.com',
          nvp_site_mail: nvp_site_mail,
          at: at
        },
        followAllRedirects: true,
      }).send();
    }).then(res => {
      let baseurl = res.body.split(/base href="(.+?)"/)[1];
      let mailurl = res.body.split(/input.+?type=checkbox.+?href="(.+?)"/)[1];
      return this.createRequest({method: 'GET', url: baseurl+mailurl.replace(/&amp;/g,'&'), headers: {referer: res.request.uri.href}}).send();
    }).then(res => {
      let igurl = res.body.split(/href="https.+?q=(http.+?confirm.+?)"/)[1].replace(/&amp;/g,'&');
      return this.createRequest({method: 'GET', url: decodeURIComponent(igurl)}).send();
    })
}

Session.prototype.logout = function () {
  return this.createRequest(CONSTANTS.REQUESTS.logout).send()
    .then(res => this.createRequest({ method: 'GET', url: res.body.split(/src="(.+?)"/)[1] }).send())
    .then(res => res.body)
}

Session.prototype.isExpired = function () {
  return new Promise((resolve, reject) => {
    return this._cookiesStore.findCookie('google.com', '/', 'SID', (err, cookie) => {
      return resolve(!err && cookie && cookie.value !== 'EXPIRED' ? true : false);
    })
  })
}
