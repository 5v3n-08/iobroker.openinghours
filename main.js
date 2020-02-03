'use strict';

/*
 * Created with @iobroker/create-adapter v1.21.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;
const _ = require('lodash');

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
        const shops = ['NetteBad Nettetal', 'Kino Kaldenkirchen'];


        // axios.get(findPlaceURL, {
        //     params: {
        //         input: 'NetteBad Nettetal',
        //         inputtype: 'textquery',
        //         fields: 'formatted_address,name,rating,opening_hours,place_id',
        //         key: this.config.apiKey
        //     }
        // }).then((response) => {
        //     this.log.info('response');
        //     this.log.info(JSON.stringify(response.data));
        // }).catch((error) => {
        //     this.log.info('error');
        //     this.log.info(JSON.stringify(error));
        // }).then(() => {
        //     // always executed
        // }); 

        
        _.each(shops, (shop, index) => {
            this.log.info('SHOP: ' + shop);
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


            this.getState(index + '.place_id', (err, state) => {
                if (!_.has(state, 'val')) {
                    this.log.info('NO PLACE ID FOUND -> make request');
                    this.getPlaceID(shop).then((response) => {
                        if (response) {
                            if (_.has(response, 'candidates') && !_.isEmpty(response.candidates)) {
                                this.setState(index + '.place_id', response.candidates[0].place_id, true);
                                this.log.info('SET PLACE ID: ' + response.candidates[0].place_id);
                            } else {
                                this.log.info('No results for: ' + shop);
                            }
                        }
                    }).then(() => {
                        this.getPlaceDetails(index);
                    });
                } else {
                    this.getPlaceDetails(index);
                }
            });
        });
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
        const demoURL = 'https://reqres.in/api/users?page=2';
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
            this.log.info(JSON.stringify(response.data));
            // return {'candidates' : [{'place_id' : 'ChIJZXMagvlQx0cRTrrzj1KNwsI'}], 'status': 'OK'};
            return response.data;
        } catch (error) {
            this.log.info('error');
            this.log.info(JSON.stringify(error.data));
        }
    }

    getPlaceDetails (index) {
        const demoURL = 'https://reqres.in/api/users?page=2';
        const detailsPlaceURL = 'https://maps.googleapis.com/maps/api/place/details/json';

        this.getState(index + '.place_id', (err, state) => {
            if (state && _.has(state, 'val') && state.val) {
                axios.get(detailsPlaceURL, {
                    params: {
                        place_id: state.val,
                        fields: 'formatted_address,name,permanently_closed,place_id,type,opening_hours,website,international_phone_number,rating',
                        key: this.config.apiKey,
                        language: 'de'
                    }
                }).then((response) => {
                    const responseX = { 'data' : {
                        'html_attributions': [],
                        'result': {
                            'formatted_address': 'Grenzwaldstraße 15A, 41334 Nettetal, Germany',
                            'international_phone_number': '+49 2157 3575',
                            'name': 'Corso Filmcasino',
                            'place_id': 'ChIJZXMagvlQx0cRTrrzj1KNwsI',
                            'rating': 4.7,
                            'types': [
                                'movie_theater',
                                'point_of_interest',
                                'establishment'
                            ],
                            'url': 'https://maps.google.com/?cid=14033934774581836366',
                            'vicinity': 'Grenzwaldstraße 15A, Nettetal',
                            'opening_hours': {
                                'open_now': true,
                                'periods': [
                                    {
                                        'close': {
                                            'day': 0,
                                            'time': '1700'
                                        },
                                        'open': {
                                            'day': 0,
                                            'time': '0900'
                                        }
                                    },
                                    {
                                        'close': {
                                            'day': 1,
                                            'time': '2045'
                                        },
                                        'open': {
                                            'day': 1,
                                            'time': '0845'
                                        }
                                    },
                                    {
                                        'close': {
                                            'day': 2,
                                            'time': '2100'
                                        },
                                        'open': {
                                            'day': 2,
                                            'time': '0700'
                                        }
                                    },
                                    {
                                        'close': {
                                            'day': 3,
                                            'time': '2100'
                                        },
                                        'open': {
                                            'day': 3,
                                            'time': '0700'
                                        }
                                    },
                                    {
                                        'close': {
                                            'day': 4,
                                            'time': '2100'
                                        },
                                        'open': {
                                            'day': 4,
                                            'time': '0700'
                                        }
                                    },
                                    {
                                        'close': {
                                            'day': 5,
                                            'time': '2100'
                                        },
                                        'open': {
                                            'day': 5,
                                            'time': '0700'
                                        }
                                    },
                                    {
                                        'close': {
                                            'day': 6,
                                            'time': '1600'
                                        },
                                        'open': {
                                            'day': 6,
                                            'time': '0900'
                                        }
                                    }
                                ],
                                'weekday_text': [
                                    'Montag: 08:45–20:45 Uhr',
                                    'Dienstag: 07:00–21:00 Uhr',
                                    'Mittwoch: 07:00–21:00 Uhr',
                                    'Donnerstag: 07:00–21:00 Uhr',
                                    'Freitag: 07:00–21:00 Uhr',
                                    'Samstag: 09:00–16:00 Uhr',
                                    'Sonntag: 09:00–17:00 Uhr'
                                ]
                            },
                        },
                        'status': 'OK'
                    }};

                    if (_.has(response, 'data') && _.has(response.data, 'result') && !_.isEmpty(response.data.result)) {
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
                            if (_.has(response.data.result, type.name)) {
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
                                this.setState(index + '.' + type.name, response.data.result[type.name], true);
                            }
                        });

                        if (_.has(response.data.result, 'opening_hours')) {
                            if (_.has(response.data.result.opening_hours, 'open_now')) {
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
                                this.setState(index + '.open_now', response.data.result.opening_hours.open_now, true);
                            }
                            if (_.has(response.data.result.opening_hours, 'weekday_text')) {
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
                                this.setState(index + '.weekday_text', response.data.result.opening_hours.weekday_text, true);
                            }

                            // if (_.has(response.data.result.opening_hours, 'periods')) {
                            //     this.setObjectNotExists(index + '.weekday_text', {
                            //         type: 'state',
                            //         common: {
                            //             name: 'weekday_text',
                            //             type: 'array',
                            //             role: '',
                            //             read: true,
                            //             write: false,
                            //         },
                            //         native: {}
                            //     });
                            //     this.setState(index + '.open_now', response.data.result.opening_hours.weekday_text, true);
                            // }
                        }
                    }
                });
            }
        });
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