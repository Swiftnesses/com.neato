var http = require('http.min')
var crypto = require('crypto')
fs = require('fs')

var cert = `-----BEGIN CERTIFICATE-----
MIIE3DCCA8SgAwIBAgIJALHphD11lrmHMA0GCSqGSIb3DQEBBQUAMIGkMQswCQYD
VQQGEwJVUzELMAkGA1UECBMCQ0ExDzANBgNVBAcTBk5ld2FyazEbMBkGA1UEChMS
TmVhdG8gUm9ib3RpY3MgSW5jMRcwFQYDVQQLEw5DbG91ZCBTZXJ2aWNlczEZMBcG
A1UEAxQQKi5uZWF0b2Nsb3VkLmNvbTEmMCQGCSqGSIb3DQEJARYXY2xvdWRAbmVh
dG9yb2JvdGljcy5jb20wHhcNMTUwNDIxMTA1OTA4WhcNNDUwNDEzMTA1OTA4WjCB
pDELMAkGA1UEBhMCVVMxCzAJBgNVBAgTAkNBMQ8wDQYDVQQHEwZOZXdhcmsxGzAZ
BgNVBAoTEk5lYXRvIFJvYm90aWNzIEluYzEXMBUGA1UECxMOQ2xvdWQgU2Vydmlj
ZXMxGTAXBgNVBAMUECoubmVhdG9jbG91ZC5jb20xJjAkBgkqhkiG9w0BCQEWF2Ns
b3VkQG5lYXRvcm9ib3RpY3MuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAur0WFcJ2YvnL3dtXJFv3lfCQtELLHVcux88tH7HN/FTeUvCqdleDNv4S
mXWgxVOdUUuhV885wppYyXNzDDrwCyjPmYj0m1EZ4FqTCcjFmk+xdEJsPsKPgRt5
QqaO0CA/T7dcIhT/PtQnJtcjn6E6vt2JLhsLz9OazadwjvdkejmfrOL643FGxsIP
8hu3+JINcfxnmff85zshe0yQH5yIYkmQGUPQz061T6mMzFrED/hx9zDpiB1mfkUm
uG3rBVcZWtrdyMvqB9LB1vqKgcCRANVg5S0GKpySudFlHOZjekXwBsZ+E6tW53qx
hvlgmlxX80aybYC5hQaNSQBaV9N4lwIDAQABo4IBDTCCAQkwHQYDVR0OBBYEFM3g
l7v7HP6zQgF90eHIl9coH6jhMIHZBgNVHSMEgdEwgc6AFM3gl7v7HP6zQgF90eHI
l9coH6jhoYGqpIGnMIGkMQswCQYDVQQGEwJVUzELMAkGA1UECBMCQ0ExDzANBgNV
BAcTBk5ld2FyazEbMBkGA1UEChMSTmVhdG8gUm9ib3RpY3MgSW5jMRcwFQYDVQQL
Ew5DbG91ZCBTZXJ2aWNlczEZMBcGA1UEAxQQKi5uZWF0b2Nsb3VkLmNvbTEmMCQG
CSqGSIb3DQEJARYXY2xvdWRAbmVhdG9yb2JvdGljcy5jb22CCQCx6YQ9dZa5hzAM
BgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBBQUAA4IBAQB93p+MUmKH+MQI3pEVvPUW
y+VDB5qt1spE5J0awVwUzhQ7QXkEqgFfOk0kzufvxdha9wz+05E1glQ8l5CzlATu
kA7V5OsygYB+TgqjvhfFHkSI6TJ8OlKcAJuZ2yQE8s2+LVo92NLwpooZLA6BCahn
fX+rzmo6b4ylhyX98Tm3upINNH3whV355PJFgk74fw9N7U6cFlBrqXXssKOse2D2
xY65IK7OQxSq5K5OPFLwN3h/eURo5kwl7jhpJhJbFL4I46OkpgqWHxQEqSxQnS0d
AC62ApwWkm42i0/DGODms2tnGL/DaCiTkgEE+8EEF9kfvQDtMoUDNvIkl7Vvm914
-----END CERTIFICATE-----`

function Robot(name, serial, secret) {
    this._baseUrl = 'https://nucleo.neatocloud.com/vendors/neato/robots/'
    this.name = name
    this._serial = serial
    this._secret = secret
    this.eco = false
    this.spotWidth = 100
    this.spotHeight = 100
    this.spotRepeat = false

    //updated when getState() is called
    this.isCharging = null
    this.isDocked = null
    this.isScheduleEnabled = null
    this.dockHasBeenSeen = null
    this.charge = null
    this.canStart = null
    this.canStop = null
    this.canPause = null
    this.canResume = null
    this.canGoToBase = null
}

Robot.prototype.getState = function getState(callback) {
    doAction(this, 'getRobotState', null, (function(error, result) {
        if (typeof callback === 'function') {
            if (result === undefined) {
                if (!error) {
                    error = 'no result'
                }
                callback(error, null)
            } else if (result && 'message' in result) {
                callback(result.message, result)
            } else {
                this.isCharging = result.details.isCharging
                this.isDocked = result.details.isDocked
                this.isScheduleEnabled = result.details.isScheduleEnabled
                this.dockHasBeenSeen = result.details.dockHasBeenSeen
                this.charge = result.details.charge
                this.canStart = result.availableCommands.start
                this.canStop = result.availableCommands.stop
                this.canPause = result.availableCommands.pause
                this.canResume = result.availableCommands.resume
                this.canGoToBase = result.availableCommands.goToBase
                callback(error, result)
            }
        }
    }).bind(this))
}

Robot.prototype.getSchedule = function getSchedule(callback) {
    doAction(this, 'getSchedule', null, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'data' in result && 'enabled' in result.data) {
                callback(null, result.data.enabled)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result)
            }
        }
    })
}

Robot.prototype.enableSchedule = function enableSchedule(callback) {
    doAction(this, 'enableSchedule', null, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}

Robot.prototype.disableSchedule = function disableSchedule(callback) {
    doAction(this, 'disableSchedule', null, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}



Robot.prototype.sendToBase = function sendToBase(callback) {
    doAction(this, 'sendToBase', null, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}

Robot.prototype.stopCleaning = function stopCleaning(callback) {
    doAction(this, 'stopCleaning', null, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}

Robot.prototype.pauseCleaning = function pauseCleaning(callback) {
    doAction(this, 'pauseCleaning', null, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}

Robot.prototype.resumeCleaning = function resumeCleaning(callback) {
    doAction(this, 'resumeCleaning', null, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}

Robot.prototype.startSpotCleaning = function startSpotCleaning(eco, width, height, repeat, callback) {
    if (typeof eco === 'function') {
        callback = eco
        eco = this.eco
        width = this.spotWidth
        height = this.spotHeight
        repeat = this.spotRepeat
    } else if (typeof width === 'function') {
        callback = width
        width = this.spotWidth
        height = this.spotHeight
        repeat = this.spotRepeat
    } else if (typeof height === 'function') {
        callback = height
        height = this.spotHeight
        repeat = this.spotRepeat
    } else if (typeof repeat === 'function') {
        callback = repeat
        repeat = this.spotRepeat
    }

    if (typeof width !== 'number' || width < 100) {
        width = 100
    }
    if (typeof height !== 'number' || height < 100) {
        height = 100
    }
    var params = {
        category: 3, //1: manual, 2: house, 3: spot (see spotWidth/spotHeight)
        mode: eco ? 1 : 2, //1: eco, 2: turbo
        modifier: repeat ? 2 : 1, //spot: clean spot 1 or 2 times
        spotWidth: width,
        spotHeight: height
    }
    doAction(this, 'startCleaning', params, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}

Robot.prototype.startManualCleaning = function startSpotCleaning(eco, callback) {
    if (typeof eco === 'function') {
        callback = eco
        eco = this.eco
    }

    var params = {
        category: 1, //1: manual, 2: house, 3: spot (spotWidth/spotHeight)
        mode: eco ? 1 : 2, //1: eco, 2: turbo
        modifier: 1 //spot: clean spot 1 or 2 times
    }
    doAction(this, 'startCleaning', params, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}

Robot.prototype.startCleaning = function startSpotCleaning(eco, callback) {
    if (typeof eco === 'function') {
        callback = eco
        eco = this.eco
    }

    var params = {
        category: 2, //1: manual, 2: house, 3: spot (see spotWidth/spotHeight)
        mode: eco ? 1 : 2, //1: eco, 2: turbo
        modifier: 1 //spot: clean spot 1 or 2 times
    }
    doAction(this, 'startCleaning', params, function(error, result) {
        if (typeof callback === 'function') {
            if (error) {
                callback(error, result)
            } else if (result && 'result' in result && result.result == 'ok') {
                callback(null, result.result)
            } else {
                callback(result && 'message' in result ? result.message : 'failed', result && 'result' in result ? result.result : result)
            }
        }
    })
}

function doAction(robot, command, params, callback) {
    if (robot._serial && robot._secret) {
        var payload = {
            reqId: '1',
            cmd: command
        }
        if (params) {
            payload.params = params
        }
        payload = JSON.stringify(payload)
        var date = new Date().toUTCString()
        var data = [robot._serial.toLowerCase(), date, payload].join("\n")
        var hmac = crypto.createHmac('sha256', robot._secret).update(data).digest('hex')

        var failed = (message) => {
            if (err.stack) {
                Homey.log('I got a stacktrace!', err.stack)
            }

            Homey.log("Error performing API call", command, message)
            if (typeof callback === 'function') {
                callback(true, "Error: " + message)
            }
        }

        http.post({
                    protocol: 'https:',
                    hostname: 'nucleo.neatocloud.com',
                    path: '/vendors/neato/robots/' + robot._serial + '/messages',
                    headers: {
                        'date': date,
                        'authorization': 'NEATOAPP ' + hmac,
                        'accept': 'application/vnd.neato.nucleo.v1'
                    },
                    json: true,
                    ca: cert
                },
                payload
            )
            .then((response) => {
                if (response.response.statusCode == '200') {
                    callback(false, response.data)
                } else {
                    Homey.log('Failed sending command to Robot', response.message)
                    failed(response.data.message)
                }

                response = callback = null
            })
            .catch(failed)

    } else {
        if (typeof callback === 'function') {
            callback('no serial or secret')
        }
    }
}

module.exports = Robot
