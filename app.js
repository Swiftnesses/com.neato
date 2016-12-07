"use strict"

const NeatoApi = require("./neato")

module.exports = new class {
    constructor() {
        this.config = {
            api: {
                beehive: "beehive.neatocloud.com",
                oauthHost: "apps.neatorobotics.com",
                callback: "https://callback.athom.com/oauth2/callback/"
            }
        }

        // Get from secure environment
        this.config.api.id = Homey.env.CLIENT_ID
        this.config.api.secret = Homey.env.CLIENT_SECRET
        Homey.log("Application secure data loaded")

        this.init = this._init.bind(this)
    }

    _init() {
        Homey.log("Application initialised")
            //Homey.log(this.config)

        this.neato = new NeatoApi()
    }
}
