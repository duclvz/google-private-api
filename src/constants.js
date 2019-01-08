var _ = require('lodash');

const REQUESTS = {
    accounts: {
        method: 'GET',
        url: 'https://accounts.google.com',
    },
    logout: {
        method: 'GET',
        url: 'https://accounts.google.com/Logout',
    },
    lookup: {
        method: 'POST',
        url: 'https://accounts.google.com/_/signin/sl/lookup?hl=en&_reqid=<%= _reqid %>&rt=j',
        headers: {
            referer: 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin',
        },
        form: {
            'f.req': '["<%= username %>",null,[],null,"EN",null,null,2,false,true,[null,null,[2,1,null,1,"https://accounts.google.com/ServiceLogin?flowName=GlifWebSignIn&flowEntry=ServiceLogin",null,[],4,[],"GlifWebSignIn"],1,[null,null,[]],null,null,null,true],"<%= username %>"]',
        },
    },
    challenge: {
        method: 'POST',
        url: 'https://accounts.google.com/_/signin/sl/challenge?hl=en&_reqid=<%= _reqid %>&rt=j',
        headers: {
            referer: 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin',
        },
        form: {
            'f.req': '["<%= token %>",null,1,null,[1,null,null,null,["<%= password %>",null,true]],[null,null,[2,1,null,1,"https://accounts.google.com/ServiceLogin?flowName=GlifWebSignIn&flowEntry=ServiceLogin",null,[],4,[],"GlifWebSignIn"],1,[null,null,[]],null,null,null,true]]',
        },
    },
    selectChallenge: {
        method: 'POST',
        url: 'https://accounts.google.com/_/signin/selectchallenge?hl=en&TL=<%= TL %>&_reqid=<%= _reqid %>&rt=j',
        headers: {
            referer: 'https://accounts.google.com/signin/v2/challenge/selection?flowName=GlifWebSignIn&flowEntry=ServiceLogin&cid=1&navigationDirection=forward&TL=<%= TL %>&lid=4',
        },
        form: {
            'f.req': '[<%= challengeChoices[challengeSelection].cid %><%= challengeSelection == "smsCode" ? ",\\"SMS\\"" : challengeSelection == "voiceCode" ? ",\\"VOICE\\"" : "" %>]',
        },
    },
    challengeVerify: {
        method: 'POST',
        url: 'https://accounts.google.com/_/signin/challenge?hl=en&TL=<%= TL %>&_reqid=<%= _reqid %>&rt=j',
        headers: {
            referer: 'https://accounts.google.com/signin/v2/challenge/kpp?flowName=GlifWebSignIn&flowEntry=ServiceLogin&cid=<%= challengeChoices[challengeSelection].cid %>&navigationDirection=forward&TL=<%= TL %>&lid=4'
        },
        form: {
            'f.req': '["<%= token %>", null, <%= challengeChoices[challengeSelection].cid %>, null, [<%= challengeChoices[challengeSelection].did %>, null, null, null, null, null, null, null, <%= challengeSelection == "smsCode" || challengeSelection == "voiceCode" ? ("[null, \\"" + code + "\\", null, 2]") : "null, null, null, null, null, null, null, null, " + (challengeSelection == "recoveryPhone" ? ("[\\"" + recoveryPhone + "\\", \\"" + recoveryPhoneRegion + "\\"]") : challengeSelection == "recoveryMail" ? ("null, null, [\\""+ recoveryMail +"\\"]") : "") %>]]',
        },
    },
    checkCookie: {
        method: 'GET',
        headers: {
            'upgrade-insecure-requests': '1',
            referer: 'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn&flowEntry=ServiceLogin',
        }
    },
    setSID: {
        method: 'GET',
        headers: {
            'upgrade-insecure-requests': '1',
            referer: 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Faccounts.google.com%2FManageAccount&hl=en&authuser=0&passive=true&sarp=1&aodrpl=1&checkedDomains=youtube&checkConnection=youtube%3A403%3A1&pstMsg=1',
        }
    },
    idvreenable: {
        method: 'GET',
        url: 'https://accounts.google.com/speedbump/idvreenable',
        headers: {
            'upgrade-insecure-requests': '1',
            referer: 'https://accounts.google.com/signin/v2/sl/pwd?flowName=GlifWebSignIn&flowEntry=ServiceLogin&cid=1&navigationDirection=forward',
        }
    },
    sendidv: {
        method: 'POST',
        url: 'https://accounts.google.com/speedbump/idvreenable/sendidv',
        headers: {
            'upgrade-insecure-requests': '1',
            referer: 'https://accounts.google.com/speedbump/idvreenable?continue=https://accounts.google.com/ManageAccount&checkedDomains=youtube&checkConnection=youtube:1542:1&pstMsg=1&TL=<%= TL %>',
        },
        form: {
            TL: true,
            deviceCountry: 'VN',
            deviceAddress: 'xxxxxxxxxx',
            deliveryMethod: 'textMessage',
            SendCode: 'Nhận mã',
        }
    },
    verifyidv: {
        method: 'POST',
        url: 'https://accounts.google.com/speedbump/idvreenable/verifyidv',
        headers: {
            'upgrade-insecure-requests': '1',
            referer: 'https://accounts.google.com/speedbump/idvreenable/sendidv',
        },
        form: {
            TL: true,
            smsUserPin: 'xxxxxx',
            VerifyPhone: 'Xác minh',
        }
    },
    ytAccount: {
        method: 'GET',
        url: 'https://www.youtube.com/account',
    },
    channelSwitcher: {
        method: 'GET',
        url: 'https://www.youtube.com/channel_switcher?feature=settings&next=%2Faccount',
    },
    listLanguage: {
        method: 'GET',
        simple: false,
        url: 'https://www.youtube.com/picker_ajax?action_language=1&base_url=https%3A%2F%2Fwww.youtube.com%2F'
    },
    pickLanguage: {
        method: 'POST',
        url: 'https://www.youtube.com/picker_ajax?action_update_language=1',
        followAllRedirects: true,
        simple: false,
    },
    ytDashboard: {
        method: 'GET',
        url: 'https://www.youtube.com/dashboard?o=U',
        simple: false
    },
    ytFeatures: {
        method: 'GET',
        url: 'https://www.youtube.com/features',
        simple: false
    },
    ytMonetization: {
        method: 'GET',
        url: 'https://www.youtube.com/account_monetization',
        simple: false
    },
    ytAdsene: {
        method: 'GET',
        url: 'https://www.youtube.com/account_monetization?action_adsense_connection=1',
        simple: false
    }
};

module.exports = {
    REQUESTS: Object.freeze(REQUESTS),
    chromeAgentTemplate: 'Mozilla/5.0 (Linux; Android <%= release %>; <%= model %> Build/<%= build %>; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/70.0.3538.110 Mobile Safari/537.36',
    chromeAgentDesktopTemplate: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36'
}
