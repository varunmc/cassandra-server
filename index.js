'use strict';

var fs = require('fs-extra'),
	path = require('path'),
	Q = require('q'),
	stripJsonComments = require('strip-json-comments'),
	winston = require('winston'),
	yaml = require('js-yaml');

// the server process
var child;

/**
 * Creates a YAML configuration file by merging user options with defaults.
 * @param {Object} options - the user options
 * @private
 * @returns {Promise}
 */
function resolveOptions(options) {
	// load defaults
	return Q.nfcall(fs.readFile, path.resolve('cassandra.json'), 'utf-8')
		.then(function(json) {
			var defaults = JSON.parse(stripJsonComments(json));

			// merge user options
			for(var property in options) {
				if(options.hasOwnProperty(property)) {
					defaults[property] = options[property];
				}
			}
			winston.debug('Resolved cassandra options are:', options);

			// create yaml file
			return Q.nfcall(fs.writeFile, path.resolve('apache-cassandra-2.1.0/conf/cassandra.yaml'), yaml.dump(defaults));
		})
}

var cassandra = {};
module.exports = cassandra;
