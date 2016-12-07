'use strict'

module.exports = [{
    description: 'Deauthorize Homey',
    method: 'PUT',
    path: '/deauthorize/',
    fn: (callback, args) => {
        Homey.app.neato.deauthorize(callback)
            .then((user) => {
                Homey.manager('api').realtime('authorized', false)
            })
            .catch((error) => {
                Homey.manager('api').realtime('authorized', true)
            })
    }
}, {
    description: 'Authorize Homey',
    method: 'PUT',
    path: '/authorize/',
    fn: (callback, args) => {
        Homey.app.neato.authorize(callback)
            .then((user) => {
                Homey.manager('api').realtime('authorized', true)
            })
            .catch((error) => {
                Homey.manager('api').realtime('authorized', false)
            })

    }
}]
