'use strict';

var childProcess = require('child_process'),
	Client = require('cassandra-driver').Client,
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
 * Configures the client.
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
 * @returns {Promise} - a promise that resolves to the merged options
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
			return Q.nfcall(fs.writeFile, path.resolve('apache-cassandra-2.1.0/conf/cassandra.yaml'), yaml.dump(defaults))
				.then(function() {
					return defaults;
				});
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
 * Starts the server.
 * @param {Object} [options] - user options
 * @returns {Promise}
 */
cassandra.start = function(options) {
	options = options || {};

	// if already started
	if(child) {
		winston.warn('Cassandra has already started');
		return Q();
	}

	var deferred = Q.defer(),
		timeoutId;

	winston.info('Starting Cassandra with user options:', options);

	resolveOptions(options)
		// start the server
		.then(function(merged) {
			child = childProcess.spawn(path.resolve('apache-cassandra-2.1.0/bin/cassandra'), ['-f']);

			// error handler
			child.on('error', function(err) {
				var error = new Error('Cassandra process error');
				error.cause = err;
				winston.error(error);

				// if we're starting up
				if(timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = undefined;
					deferred.reject(error);
				}
			});

			// exit handler
			child.on('exit', function(code) {
				// if we're starting up
				if(timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = undefined;

					var error = new Error('Could not start cassandra');
					winston.error(error);
					deferred.reject(error);
				}
				if(code !== 0) {
					winston.warn('Cassandra exited with code:', code);
				}
			});

			// stderr handler
			child.stderr.on('data', function(data) {
				winston.error(data.toString());
			});

			// stdout listener
			child.stdout.on('data', function(data) {
				winston.info(data.toString());
			});

			// give it 5 seconds to start
			timeoutId = setTimeout(function() {
				// TODO: read this from merged options
				configureClient(['localhost']);

				// resolve the startup promise when the client connects
				client.connect()
					.then(function() {
						deferred.resolve();
					})
					.catch(function(err) {
						var error = new Error('Could not connect to Cassandra');
						error.cause = err;
						winston.error(error);

						// since the client could not connect we may as well kill the server
						cassandra.stop()
							.done(function() {
								deferred.reject(error);
							});
					})
					.done(function() {
						timeoutId = undefined;
					});
			}, 5000);
		});

	return deferred.promise;
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
		winston.info('Stopping Cassandra');

		child.kill();
		child = client = undefined;
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
