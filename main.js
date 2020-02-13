'use strict';

/*
 * Created with @iobroker/create-adapter v1.21.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;
const _ = require('lodash');
const moment = require('moment');

// Load your modules here, e.g.:
// const fs = require("fs");

class Template extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'openinghours',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        moment.locale('de');

        _.each(this.config.shops, (shop, index) => {
            this.getState(index + '.place_id', (err, state) => {
                let place_id = null;
                if (_.isEmpty(state)) {
                    const matches = shop.name.trim().match(/[\S]{27}/);
                    if (_.isEmpty(matches)) {
                        this.log.info('MAKE REQEST GO GET ID OF: ' + shop.name);
                        this.getPlaceID(shop.name).then((response) => {
                            if (response && _.has(response, 'candidates') && !_.isEmpty(response.candidates)) {
                                place_id = response.candidates[0].place_id;
                            } else if (response && _.has(response, 'error_message')) {
                                this.log.warn(shop.name + ': ' + response.error_message);
                            } else {
                                this.log.info('ERROR: ' + shop.name);
                            }
                        });
                    } else {
                        place_id = _.first(matches);
                    }
                } else {
                    place_id = state.val;
                }

                setTimeout(() => { 
                    if (place_id) {
                        this.setObjectNotExists(index + '.place_id', {
                            type: 'state',
                            common: {
                                name: 'place_id',
                                type: 'string',
                                role: 'id',
                                read: true,
                                write: false,
                            },
                            native: {}
                        });
                    }
                    this.setState(index + '.place_id', place_id, true);
                    this.log.info(shop.name + ': ' + place_id);
                }, 10000);


                setTimeout(() => {
                    this.getPlaceDetails(place_id).then((response) => {
                        if (response && _.has(response, 'error_message')) {
                            this.log.warn(shop.name + ': ' + response.error_message);
                        } else {
                            this.mapResponse(response, index);
                            this.initPeriods(response, index);
                            this.mapPeriods(response, index);
                        }
                    });
                }, 20000);
            });
        });

        setTimeout(this.stop.bind(this), 50000);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            // this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === 'object' && obj.message) {
    // 		if (obj.command === 'send') {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info('send command');

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    // 		}
    // 	}
    // }


    async getPlaceID (shop) {
        const findPlaceURL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
        try {
            const response = await axios.get(findPlaceURL, {
                params: {
                    input: shop,
                    inputtype: 'textquery',
                    fields: 'place_id',
                    key: this.config.apiKey
                }
            });
            return response.data;
        } catch (error) {
            this.log.info(JSON.stringify(error));
        }
        
    }

    async getPlaceDetails (place_id) {
        const detailsPlaceURL = 'https://maps.googleapis.com/maps/api/place/details/json';
        try {
            const response = await axios.get(detailsPlaceURL, {
                params: {
                    place_id: place_id,
                    fields: 'formatted_address,name,permanently_closed,place_id,type,opening_hours,international_phone_number,rating,website',
                    key: this.config.apiKey,
                    language: 'de'
                }
            });
            return response.data;
        } catch (error) {
            this.log.info(JSON.stringify(error));
        }
        
    }


    mapResponse (response, index) {
        if (_.has(response, 'result') && !_.isEmpty(response.result)) {
            const types = [
                { name: 'formatted_address', type: 'string', role: ''},
                { name: 'international_phone_number', type: 'string', role: ''},
                { name: 'name', type: 'string', role: ''},
                { name: 'rating', type: 'float', role: ''},
                { name: 'types', type: 'array', role: ''},
                { name: 'website', type: 'string', role: ''},
                { name: 'permanently_closed', type: 'string', role: ''},
            ];

            _.each(types, (type) => {
                if (_.has(response.result, type.name)) {
                    this.setObjectNotExists(index + '.' + type.name, {
                        type: 'state',
                        common: {
                            name: type.name,
                            type: type.type,
                            role: '',
                            read: true,
                            write: false,
                        },
                        native: {}
                    });
                    this.setState(index + '.' + type.name, response.result[type.name], true);
                }
            });

            if (_.has(response.result, 'opening_hours')) {
                if (_.has(response.result.opening_hours, 'open_now')) {
                    this.setObjectNotExists(index + '.open_now', {
                        type: 'state',
                        common: {
                            name: 'open_now',
                            type: 'boolean',
                            role: '',
                            read: true,
                            write: false,
                        },
                        native: {}
                    });
                    this.setState(index + '.open_now', response.result.opening_hours.open_now, true);
                }

                if (_.has(response.result.opening_hours, 'weekday_text')) {
                    this.setObjectNotExists(index + '.weekday_text', {
                        type: 'state',
                        common: {
                            name: 'weekday_text',
                            type: 'array',
                            role: '',
                            read: true,
                            write: false,
                        },
                        native: {}
                    });
                    this.setState(index + '.weekday_text', response.result.opening_hours.weekday_text, true);
                }
            }
        }
    }

    initPeriods (response, index) {
        if (_.has(response.result.opening_hours, 'periods')) {
            this.setObjectNotExists(index + '.periods', {
                type: 'channel',
                common: {
                    name: 'periods'
                },
                native: {}
            });

            for (let i = 0; i < 7; i++) {
                this.setObjectNotExists(index + '.periods.' + this.getWeekDay(i), {
                    type: 'channel',
                    common: {
                        name: this.getWeekDay(i)
                    },
                    native: {}
                });
                this.setObjectNotExists(index + '.periods.' + this.getWeekDay(i) + '.open', {
                    type: 'state',
                    common: {
                        name: 'open',
                        type: 'boolean',
                        role: '',
                        read: true,
                        write: false,
                        def: false
                    },
                    native: {}
                });
            }

            this.setObjectNotExists(index + '.periods.today', {
                type: 'channel',
                common: {
                    name: 'today'
                },
                native: {}
            });
            this.setObjectNotExists(index + '.periods.today.open', {
                type: 'state',
                common: {
                    name: 'open',
                    type: 'boolean',
                    role: '',
                    read: true,
                    write: false,
                },
                native: {}
            });


        }
    }

    mapPeriods (response, index) {
        const count = {};
        _.each(response.result.opening_hours.periods, (period) => {
            if (_.has(count, this.getWeekDay(period.open.day))) {
                count[this.getWeekDay(period.open.day)]++;
            } else {
                count[this.getWeekDay(period.open.day)] = 0;
            }

            this.setObjectNotExists(index + '.periods.' + this.getWeekDay(period.open.day) + '.' + count[this.getWeekDay(period.open.day)], {
                type: 'state',
                common: {
                    name: count[this.getWeekDay(period.open.day)],
                    type: 'string',
                    role: '',
                    read: true,
                    write: false,
                },
                native: {}
            });

            if (moment().format('dddd') == this.getWeekDay(period.open.day)) {
                this.setState(index + '.periods.today.open', true, true);
                this.setState(index + '.periods.today.' + count[this.getWeekDay(period.open.day)], this.getTime(period.open.time) + ' - ' + this.getTime(period.close.time), true);
            }
            this.setState(index + '.periods.' + this.getWeekDay(period.open.day) + '.open', true, true);
            this.setState(index + '.periods.' + this.getWeekDay(period.open.day) + '.' + count[this.getWeekDay(period.open.day)], this.getTime(period.open.time) + ' - ' + this.getTime(period.close.time), true);
        });
    }


    getWeekDay (day) {
        return moment().day(day).format('dddd');
    }
    getTime (time) {
        return moment(time, 'HHmm').format('HH:mm');
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Template(options);
} else {
    // otherwise start the instance directly
    new Template();
}