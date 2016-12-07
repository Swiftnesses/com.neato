'use strict'

module.exports = class {

    constructor(driver) {
        this.driver = driver
    }

    getCapabilities() {
        return {
            measure_battery: {
                get: this.ignore_capability_get.bind(this)
            },
            vacuumcleaner_state: {
                get: this.ignore_capability_get.bind(this),
                set: this.set_state.bind(this)
            }
        }
    }

    // Device card (capability) functions
    ignore_capability_get(device, callback) {
        // Apparently, since version 1.0, capability GET functions are only called when the app has just been initialised.
        // We don't have the robot status at this moment so always return false
        // The device card is updated later with module.exports.realtime functions
        Homey.log("[Info] Ignoring capability 'get' function. This should only happen when the application or device is just initialised!")
        callback(null, false)
    }

    // Somebody changed the 'state' field in the device card
    set_state(device, command, callback) {
        var robot = this.driver.getRobot(device)

        if (robot && typeof(robot.cachedStatus) == 'object') {

            var previousStatus = this.driver.parseState4Homey(robot.cachedStatus)

            Homey.log('[Info] (Picker) Set vacuum state to', command)

            // Cancel command waiting to be executed if there is one
            clearTimeout(robot.stateCardTimeout)

            // Set timeout for command to execute in 5 second
            robot.stateCardTimeout = setTimeout(() => {
                if (command == 'cleaning') {
                    this.driver.flows.action_start_resume_house_cleaning((error, result) => {
                        // Homey.log("Robot send house claning result:", error, result)
                        if (error) {
                            Homey.log('[Error] (Picker) Start house cleaning: failed, reverting to previous state!')
                            driver.realtime(device, 'vacuumcleaner_state', previousStatus)
                        }
                    }, {
                        device: device,
                        cleaning_mode: 'false' // Default to turbo mode
                    })
                } else if (command == 'spot_cleaning') {
                    this.driver.flows.action_start_spot_cleaning((error, result) => {
                        // Homey.log("Robot send spot cleaning result:", error, result)
                        if (error) {
                            Homey.log('[Error] (Picker) Start spot cleaning: failed, reverting to previous state!')
                            this.driver.realtime(device, 'vacuumcleaner_state', previousStatus)
                        }
                    }, {
                        device: device,
                        cleaning_mode: 'false', // Default to turbo mode
                        spot_width: 100, // Default to 100
                        spot_height: 100, // Default to 100
                        cleaning_frequency: 'true' // Default to 2 passes
                    })
                } else if (command == 'stopped') {
                    this.driver.flows.action_pause_cleaning((error, result) => {
                        // Homey.log("Robot send pause result:", error, result)
                        if (error) {
                            Homey.log('[Error] (Picker) Pause cleaning: failed, reverting to previous state!')
                            this.driver.realtime(device, 'vacuumcleaner_state', previousStatus)
                        }
                    }, {
                        device: device
                    })
                } else {
                    // 'docked' and 'charging' and simply a safe default :)

                    this.driver.flows.action_send_to_base((error, result) => {
                        // Homey.log("Robot send to base result:", error, result)
                        if (error) {
                            Homey.log('[Error] (Picker) Send to base: failed, reverting to previous state!')
                            this.driver.realtime(device, 'vacuumcleaner_state', previousStatus)
                        }
                    }, {
                        device: device
                    })
                }
            }, 5000)

            // Confirm to Homey that we set the command
            callback(null, command)
        } else {
            Homey.log("[Error] (Picker) Vacuum state set but device not initialised yet")
            callback(null, false)
        }
    }

    robotStateChanged(device, cachedStatus, freshStatus) {
        var robot = this.driver.getRobot(device)
        var parsedState = this.driver.parseState4Homey(freshStatus)

        // Notify Homey for device card update
        // Also do this when the app has just been initialised
        this.driver.realtime(device, 'vacuumcleaner_state', parsedState)
    }

    robotBatteryLevelChanged(device, cachedStatus, freshStatus) {
        // Always inform Homey of a charge change, also when the device has just been initialised
        this.driver.realtime(device, 'measure_battery', freshStatus.details.charge)
    }

    // End device card (capability) functions /

}
