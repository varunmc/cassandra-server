'use strict';

var Client = require('cassandra-driver').Client,
	fs = require('fs-extra'),
	path = require('path'),
	Q = require('q'),
	stripJsonComments = require('strip-json-comments'),
	winston = require('winston'),
	yaml = require('js-yaml');

// the server process
var child;

// the cassandra client
var client;

/**
 * Configures the Cassandra client.
 * @private
 * @param {string[]} hosts - the list of contact points
 */
function configureClient(hosts) {
	client = new Client({contactPoints: hosts});
	client.connect = Q.nbind(client.connect, client);
	client.execute = Q.nbind(client.execute, client);
	client.shutdown = Q.nbind(client.shutdown, client);
}

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

/**
 * Deletes the entire database.
 * @returns {Promise}
 */
cassandra.reset = function() {
	var deferred = Q.defer();

	// if running
	if(child) {
		deferred.reject(new Error('Cannot delete database when cassandra is running'));
		return deferred.promise;
	}

	winston.warn('Deleting all data in the database');
	return Q.nfcall(fs.remove, path.resolve('apache-cassandra-2.1.0/data'))
		.then(Q.nfcall(fs.remove, path.resolve('apache-cassandra-2.1.0/logs')));
};

/**
 * Stops the server.
 * @returns {Promise}
 */
cassandra.stop = function() {
	// if already stopped
	if(!child) {
		return Q();
	}

	// function to stop the server
	function doStop() {
		winston.info('Stopping cassandra');
		child.kill();
		child = undefined;
		return Q();
	}

	// if the client couldn't connect
	if(!client) {
		return doStop();
	}

	// shutdown the client
	return client.shutdown()
		.then(doStop);
};
