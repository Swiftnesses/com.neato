"use strict"

const Robot = require('./robot')
const Flows = require('./flows')
const Devicecard = require('./devicecard')
const neato = Homey.app.neato

module.exports = new class {

    constructor() {
        // Define some internal variables
        this.devices = {}
        this.robots = {}

        // Map Homey interface functions (functions it expects to be in module.exports.XXX)
        this.init = this._init.bind(this)
        this.pair = this._pair.bind(this)
        this.added = this._device_added.bind(this)
        this.deleted = this._device_deleted.bind(this)
        // this.renamed = this._device_renamed.bind(this)
        this.settings = this._device_settings.bind(this)

        // Set up device card
        this.deviceCard = new Devicecard(this)
        this.capabilities = this.deviceCard.getCapabilities()
    }

    // Interface to Homey functions

    // AKA module.exports.init
    _init(devices, callback) {
        // Store the list of devices Homey gives us
        this.devices = devices

        Homey.log('Devices:', devices)

        // Do authorisation stuff when needed
        neato.on('authorized', this._authorized.bind(this))

        // Initialize flow logic
        this.flows = new Flows(this)

        // Ready to rock!
        callback(null, true)
    }

    _authorized(authorized) {
        if (authorized) {
            if (Object.keys(this.robots).length == 0) {
                this.initDevices()
            } else {
                Homey.log('Devices already initialised')
            }
        } else {
            this.deInitDevices()
        }
    }

    // AKA module.exports.pair
    _pair(socket) {
        socket.on('authorized', (data, callback) => {
            Homey.app.neato.isAuthorised()
                .then(() => callback(null, true))
                .catch(() => callback(null, false))
        })

        socket.on('authorize', (data, callback) => {
            Homey.app.neato.authorize(callback)
                .then((user) => {
                    socket.emit('authorized', true, null)
                })
        })

        socket.on('list_devices', (data, callback) => {
            Homey.log('[Info] List devices started')
            // list_devices event is triggered multiple times when you leave the page open
            var foundDevices = []

            Homey.app.neato.getRobots()
                .then((robots) => {
                    robots.forEach((robot) => {
                        Homey.log('Found robot:', robot)
                        if (robot.model == 'BotVacConnected') {
                            Homey.log('It\'s a Botvac connected!')
                            foundDevices.push({
                                name: robot.name,
                                data: {
                                    id: robot.serial,
                                },
                                settings: robot
                            })
                        } else {
                            Homey.log('[Error] Model is not supported by this driver')
                        }

                    })

                    Homey.log('[Info] Found devices: ', foundDevices)

                    callback(null, foundDevices)
                })
        })
    }

    // AKA module.exports.added
    _device_added(device, callback) {
        console.log('[Info] Added device: ', device)
        this.devices.push(device)
        this.initRobot(device)
    }

    // AKA module.exports.deleted
    _device_deleted(device) {
        console.log('[Info] Removed device: ', device)
        this.deInitRobot(device)
        this.devices.splice(this.devices.indexOf(device), 1)
        Homey.log('[Info] Devices left:', this.devices)
    }

    // AKA module.exports.settings
    _device_settings(device, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
        // Don't do difficult stuff. Just re-create the robot
        console.log('[Info] Settings changed. Reinitialising device.', changedKeysArr)
        callback(null, true)
        this.initRobot(device)
    }

    // End Interface to Homey functions /

    // Robot management functions

    initDevices() {
        if (Object.keys(this.devices).length > 0) {
            Homey.log('[Info] Initilise devices')
            this.devices.forEach(this.initRobot.bind(this))
        } else {
            Homey.log('[Error] No devices to initialise')
        }
    }

    deInitDevices() {
        if (Object.keys(this.devices).length > 0 && Object.keys(this.robots).length) {
            Homey.log('[Info] De-initialise all devices')
            this.devices.forEach(this.deInitRobot.bind(this))
        } else {
            Homey.log('[Error] No devices to de-initialise')
        }
    }

    deInitRobot(device) {
        module.exports.setUnavailable(device, "Robot not available at the moment")

        var robot = this.getRobot(device)
        if (robot) {
            clearInterval(robot.refreshInterval)
            Homey.log('[Info] Removing robot:', robot.name)
            delete this.robots[device.id]
        }
    }

    initRobot(device) {
        // Start clean
        this.deInitRobot(device)

        module.exports.getSettings(device, (err, settings) => {
            Homey.log('[Info] Initialising robot', settings.name + ', current settings:')
            Homey.log(settings)

            this.robots[device.id] = new Robot(settings.name, settings.serial, settings.secret_key)

            var robot = this.getRobot(device)
            // Get robot state on initialise
            robot.getState((error, robotStatus) => {
                if (!error && robotStatus.meta.modelName == 'BotVacConnected') {
                    module.exports.setAvailable(device)

                    // Set up polling at regular intervals (randomize within 100ms to prevent all robots to poll at the same time)
                    var interval = settings.polling_interval * 1000 + Math.floor(Math.random() * 100)
                    var callback = this.pollSuccess.bind(this, device)
                    robot.refreshInterval = setInterval(this.pollStatus.bind(this, device, callback), interval)

                    this.robotStatusUpdate(device, null, robotStatus)
                    robot.cachedStatus = robotStatus
                } else if (error) {
                    Homey.log("[Error] Encountered an error when fetching the robot's initial status. Retrying in " + settings.polling_interval + " seconds. Error:\n\r", error)
                    this.deInitRobot(device)
                    // Retry later
                    setTimeout(this.initRobot.bind(this, device), settings.polling_interval * 1000)
                    module.exports.setUnavailable(device, error)
                } else {
                    Homey.log('[Error] Cannot set robot available because model is unknown:', robotStatus.meta.modelName)
                    this.deInitRobot(device)
                    module.exports.setUnavailable(device, 'Model ' + robotStatus.meta.modelName + ' is unknown')
                }

            })
        })
    }

    pollStatus(device, callback) {
        var robot = this.getRobot(device)
        Homey.log('[Polling] Neato server for updates for robot: ' + robot.name)

        robot.getState(callback)
    }

    pollSuccess(device, error, robotStatus) {
        var robot = this.getRobot(device)

        if (!error && robot) {
            Homey.log("[Success] Updated data from Neato server for robot: " + robot.name)

            try {
                this.robotStatusUpdate(device, robot.cachedStatus, robotStatus)
            } catch (e) {
                Homey.log('[Error!] robotStatusUpdate:')
                Homey.log(e.stack)
            }

            robot.cachedStatus = robotStatus
        } else {
            Homey.log("[Error] Failed to update data from Neato server for robot: " + robot.name)
        }
    }

    // This function is run every time the Neato servers have been polled
    robotStatusUpdate(device, cachedStatus, freshStatus) {

        // Run on state change of state: stopped / cleaning / spot cleaning / docked / charging (to update device card and run state trigger cards)
        if (cachedStatus == null || cachedStatus.state != freshStatus.state || cachedStatus.details.isCharging != freshStatus.details.isCharging || cachedStatus.details.isDocked != freshStatus.details.isDocked) {
            Homey.log('[Info] robotStatusUpdate: State Changed')
            this.flows.robotStateChanged(device, cachedStatus, freshStatus)
            this.deviceCard.robotStateChanged(device, cachedStatus, freshStatus)
        }

        // Run on change of charge status (run trigger cards)
        if (cachedStatus == null || cachedStatus.details.isDocked != freshStatus.details.isDocked) {
            Homey.log('[Info] robotStatusUpdate: Dock Changed')
            this.flows.robotDockedChanged(device, cachedStatus, freshStatus)
        }

        // Run on change of battery level (update device card)
        if (cachedStatus == null || cachedStatus.details.charge != freshStatus.details.charge) {
            Homey.log('[Info] robotStatusUpdate: Battery Changed')
            this.flows.robotBatteryLevelChanged(device, cachedStatus, freshStatus)
            this.deviceCard.robotBatteryLevelChanged(device, cachedStatus, freshStatus)
        }
    }

    // End robot management functions /


    // Start Helper functions

    // Helper function to get the corresponding robot for a Homey 'device_data' object
    getRobot(device) {
        if (typeof(device) == 'object' && device.id && this.robots[device.id]) {
            return this.robots[device.id]
        } else if (typeof(device) == 'object' && device.name) {
            return device
        } else {
            return false
        }
    }


    // Helper function to convert the Neato status object to something Homey will understand (stopped, cleaning, spot_cleaning, docked or charging)
    parseState4Homey(robotData) {

        Homey.log('[Info] Robot state helper function running...')
        Homey.log('[Info] Analysing new robot data:')
        Homey.log(robotData)

        // device card default state == stopped
        var state = 'stopped'

        if (robotData.state == 2) {
            // device card state == cleaning
            if (robotData.action == 1) {
                state = 'cleaning'
                // device card state == spot cleaning
            } else if (robotData.action == 2) {
                state = 'spot_cleaning'
            }
        }

        // device card state == docked
        if (robotData.details.isDocked) {
            state = 'docked'
        }

        // device card state == charging
        if (robotData.details.isCharging) {
            state = 'charging'
        }

        Homey.log('[Info] Robot state helper function detected state: ' + state)
        return state
    }

    parseState(robotData) {

        Homey.log('[Info] Robot state helper function running...')
        Homey.log('[Info] Analysing new robot data:')
        Homey.log(robotData)

        // device card default state == stopped
        var state = 'stopped'

        // 1 == idle
        if (robotData.state == 1) {
            // device card state == docked
            if (robotData.details.isDocked) {
                state = 'docked'
            }

            // device card state == charging
            if (robotData.details.isCharging) {
                state = 'charging'
            }
        }

        // 2 == busy
        else if (robotData.state == 2) {
            // device card state == cleaning
            if (robotData.action == 1) {
                state = 'cleaning'
                // device card state == spot cleaning
            } else if (robotData.action == 2) {
                state = 'spot_cleaning'
            }
        } else if (robotData.state == 3) {
            state = 'paused'
        } else if (robotData.state == 4) {
            state = 'error'
        }

        Homey.log('[Info] Robot state helper function detected state: ' + state)
        return state
    }

    // End helper functions /
}
