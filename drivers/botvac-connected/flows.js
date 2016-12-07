'use strict'

module.exports = class {

    constructor(driver) {
        this.driver = driver

        // Action flows
        Homey.manager('flow').on('action.start_house_cleaning', this.action_start_resume_house_cleaning.bind(this))
        Homey.manager('flow').on('action.resume_cleaning', this.action_start_resume_house_cleaning.bind(this))
        Homey.manager('flow').on('action.stop_cleaning', this.action_stop_cleaning.bind(this))
        Homey.manager('flow').on('action.pause_cleaning', this.action_pause_cleaning.bind(this))
        Homey.manager('flow').on('action.send_to_base', this.action_send_to_base.bind(this))
        Homey.manager('flow').on('action.start_spot_cleaning', this.action_start_spot_cleaning.bind(this))

        // Condition flows
        Homey.manager('flow').on('condition.busy', this.condition_busy.bind(this))
        Homey.manager('flow').on('condition.docked', this.condition_docked.bind(this))
        Homey.manager('flow').on('condition.charging', this.condition_charging.bind(this))
        Homey.manager('flow').on('condition.paused', this.condition_paused.bind(this))
        Homey.manager('flow').on('condition.stopped', this.condition_stopped.bind(this))
    }

    robotStateChanged(device, cachedStatus, freshStatus) {
        var robot = this.driver.getRobot(device)
        var parsedState = this.driver.parseState4Homey(freshStatus)
        Homey.log('[Info] Robot state status changed to: ' + parsedState + ' for robot ' + robot.name)

        // Fire corresponding trigger card but not when the app has just initialised
        if (cachedStatus !== null) {
            var stateTriggers = ['state_stops_cleaning', 'state_starts_cleaning', 'state_paused', 'state_error']

            // Convert state number (1 through 4) to the correct trigger card name as defined in the array above
            var currentTrigger = stateTriggers[freshStatus.state - 1]

            this._triggerDevice(currentTrigger, null, null, device)
        }
    }

    robotDockedChanged(device, cachedStatus, freshStatus) {
        var robot = this.driver.getRobot(device)
        var parsedState = this.driver.parseState4Homey(freshStatus)

        Homey.log('[Info] Docking status changed to: ' + freshStatus.details.isDocked + ' for robot ' + robot.name)

        // Do not fire triggers when the app has just been initialised
        if (cachedStatus !== null) {
            if (freshStatus.details.isDocked) {
                this._triggerDevice('enters_dock', null, null, device)

            } else {
                this._triggerDevice('leaves_dock', null, null, device)
            }
        }

    }

    robotBatteryLevelChanged(device, cachedStatus, freshStatus) {
        var robot = this.driver.getRobot(device)
        Homey.log('[Info] Charge status changed to: ' + freshStatus.details.charge + ' for robot ' + robot.name)
    }

    // End trigger card functions /

    // Condition card function

    condition_docked(callback, args) {
        var robot = this.driver.getRobot(args.device)

        Homey.log("[Condition flow card] 'is docked': current state for robot " + robot.name + " is '" + robot.cachedStatus.details.isDocked + "'")
        // Return true when state is docked
        callback(null, (robot.cachedStatus.details.isDocked))
    }

    condition_charging(callback, args) {
        var robot = this.driver.getRobot(args.device)

        Homey.log("[Condition flow card] 'is charging': current state for robot " + robot.name + " is '" + robot.cachedStatus.details.isCharging + "'")
        // Return true when state is charging
        callback(null, (robot.cachedStatus.details.isCharging))
    }

    condition_busy(callback, args) {
        var robot = this.driver.getRobot(args.device)

        if (robot.cachedStatus.state == 2) {
            var busy_boolean = true
        } else {
            var busy_boolean = false
        }

        Homey.log("[Condition flow card] 'is busy': current state for robot " + robot.name + " is '" + busy_boolean + "'")
        // Return true when state equals 2
        callback(null, busy_boolean)
    }

    condition_paused(callback, args) {
        var robot = this.driver.getRobot(args.device)

        if (robot.cachedStatus.state == 3) {
            var paused_boolean = true
        } else {
            var paused_boolean = false
        }

        Homey.log("[Condition flow card] 'is paused': current state for robot " + robot.name + " is '" + paused_boolean + "'")
        // Return true when state is charging
        callback(null, paused_boolean)
    }

    condition_stopped(callback, args) {
        var robot = this.driver.getRobot(args.device)

        if (robot.cachedStatus.state == 1) {
            var stopped_boolean = true
        } else {
            var stopped_boolean = false
        }

        Homey.log("[Condition flow card] 'is stopped': current state for robot " + robot.name + " is '" + stopped_boolean + "'")
        // Return true when state is charging
        callback(null, stopped_boolean)
    }

    // End condition card function /

    // Action card functions

    action_start_resume_house_cleaning(callback, args) {
        var robot = this.driver.getRobot(args.device)

        Homey.log("[Info] Attempting to start house cleaning:", robot.name)

        // Throw error when the robot hasn't been initialized yet
        if (robot.cachedStatus == null) {
            Homey.log("[Error] Could not start house cleaning:", robot.name, "Robot has not been initialised yet.", robot)
            callback("[Error] Could not start house cleaning: " + robot.name + ", Robot has not been initialised yet.", false)
        } else {

            // When idle, start cleaning!
            if (robot.cachedStatus.state == 1) {
                robot.startCleaning(args.cleaning_mode == 'true', (error, result) => {
                    if (error) {
                        Homey.log("[Error] Attempted to start house cleaning:", error)
                    } else {
                        Homey.log("[Success] Attempted to start house cleaning:", result)
                    }

                    callback(error, result)
                })
            }
            // When busy, do nothing!
            else if (robot.cachedStatus.state == 2) {
                callback(null, true)
            }
            // When paused, resume cleaning!
            else if (robot.cachedStatus.state == 3) {
                robot.resumeCleaning((error, result) => {
                    if (error) {
                        Homey.log("[Error] Attempted to resume cleaning:", error)
                    } else {
                        Homey.log("[Success] Attempted to resume cleaning:", result)
                    }
                    callback(error, result)
                })
            }
            // Else, return error
            else {
                callback('Robot is in error state', false)
            }
        }
    }

    action_stop_cleaning(callback, args) {
        var robot = this.driver.getRobot(args.device)
        Homey.log("[Info] Attempting to stop cleaning:", robot.name)

        robot.stopCleaning((error, result) => {
            // Homey.log(error, result)
            if (error) {
                Homey.log("[Error] Attempted to stop cleaning:", error)
            } else {
                Homey.log("[Success] Attempted to stop cleaning:", result)
            }

            callback(error, result)
        })
    }

    action_pause_cleaning(callback, args) {
        var robot = this.driver.getRobot(args.device)
        Homey.log("[Info] Attempting to pause cleaning:", robot.name)

        robot.pauseCleaning((error, result) => {
            // Homey.log(error, result)
            if (error) {
                Homey.log("[Error] Attempted to pause cleaning:", error)
            } else {
                Homey.log("[Success] Attempted to pause cleaning:", result)
            }
            callback(error, result)
        })
    }

    action_send_to_base(callback, args) {
        var robot = this.driver.getRobot(args.device)
        Homey.log("[Info] Attempting to send to base:", robot.name)

        robot.sendToBase((error, result) => {
            // Homey.log(error, result)
            if (error) {
                Homey.log("[Error] Send to base:", error)
            } else {
                Homey.log("[Success] Send to base:", result)
            }
            callback(error, result)
        })
    }

    action_start_spot_cleaning(callback, args) {
        var robot = this.driver.getRobot(args.device)
        Homey.log("[Info] Attempting to start spot cleaning:", robot.name, args)

        robot.startSpotCleaning(args.cleaning_mode == 'true', args.spot_width, args.spot_height, args.cleaning_frequency == 'true', (error, result) => {
            // Homey.log(error, result)
            if (error) {
                Homey.log("[Error] Attempting to start spot cleaning:", error)
            } else {
                Homey.log("[Success] Attempting to start spot cleaning:", result)
            }
            callback(error, result)
        })
    }

    // End action card functions



    // Trigger card helper function to add some debug information
    _triggerDevice(eventName, tokens, state, device, callback) {
        var robot = this.driver.getRobot(device)
        console.log('[Trigger Flow card] \'' + eventName + '\' for robot ' + robot.name)

        if (typeof callback !== 'function') {
            callback = (err, result) => {
                if (err) return Homey.error(err)
            }
        }

        Homey.manager('flow').triggerDevice(eventName, tokens, state, device, callback)
    }

}
