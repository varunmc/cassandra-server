'use strict';

var childProcess = require('child_process'),
	Client = require('cassandra-driver').Client,
	EventEmitter = require('events').EventEmitter,
	fs = require('fs-extra'),
	path = require('path'),
	Q = require('q'),
	stripJsonComments = require('strip-json-comments'),
	yaml = require('js-yaml');

// the server process
var child;

// the Cassandra log levels
var levels = ['debug', 'info', 'warn'];

/**
 * Configures the client.
 * @private
 * @param {string[]} hosts - the list of contact points
 */
function configureClient(hosts) {
	cassandra.client = new Client({contactPoints: hosts});

	// promisify client methods
	cassandra.client.connect = Q.nbind(cassandra.client.connect, cassandra.client);
	cassandra.client.execute = Q.nbind(cassandra.client.execute, cassandra.client);
	cassandra.client.shutdown = Q.nbind(cassandra.client.shutdown, cassandra.client);
}

/**
 * Creates a YAML configuration file by merging user options with defaults.
 * @param {Object} options - the server options
 * @private
 * @returns {Promise} - a promise that resolves to the complete server options
 */
function resolveOptions(options) {
	var jsonFileName = path.join(__dirname, 'cassandra.json');
	cassandra.emit('debug', 'Reading default configuration: ' + jsonFileName);

	return Q.nfcall(fs.readFile, jsonFileName, 'utf-8')
		.then(function(json) {
			var defaults = JSON.parse(stripJsonComments(json));

			// merging user options
			for(var property in options) {
				if(options.hasOwnProperty(property)) {
					defaults[property] = options[property];
				}
			}
			cassandra.emit('debug', 'Resolved Cassandra options are: ' + defaults);

			var yamlFileName = path.join(__dirname, 'apache-cassandra-2.1.0', 'conf', 'cassandra.yaml');
			cassandra.emit('debug', 'Creating YAML configuration file: ' + yamlFileName);
			return Q.nfcall(fs.writeFile, yamlFileName, yaml.dump(defaults))
				.then(function() {
					return defaults;
				});
		})
}

var cassandra = Object.create(EventEmitter.prototype);
module.exports = cassandra;

// the Cassandra client
cassandra.client = undefined;

/**
 * Nukes the entire database.
 * @returns {Promise}
 */
cassandra.nuke = function() {
	var deferred = Q.defer();

	// if running
	if(child) {
		var error = new Error('Cannot delete database when Cassandra is running');
		cassandra.emit('error', error);
		deferred.reject(error);
		return deferred.promise;
	}

	cassandra.emit('warn', 'Deleting all data in the database');
	return Q.nfcall(fs.remove, path.join(__dirname, 'apache-cassandra-2.1.0', 'data'))
		.then(Q.nfcall(fs.remove, path.join(__dirname, 'apache-cassandra-2.1.0', 'logs')));
};

/**
 * Restarts the server.
 * @returns {Promise} - a promise that resolves to the Cassandra client
 */
cassandra.restart = function() {
	var deferred = Q.defer();

	cassandra.stop()
		.then(function() {
			cassandra.emit('info', 'Waiting three seconds before starting');
			setTimeout(function() {
				cassandra.start()
					.then(function(client) {
						deferred.resolve(client);
					})
					.catch(function(err) {
						deferred.reject(err);
					});
			}, 3000);
		});

	return deferred.promise;
};

/**
 * Starts the server.
 * @param {Object} options - the server options
 * @returns {Promise} - a promise that resolves to the Cassandra client
 */
cassandra.start = function(options) {
	options = options || {};

	var deferred = Q.defer(),
		timeoutId;

	// if already started
	if(child) {
		cassandra.emit('info', 'Cassandra is already started');
		return deferred.resolve(cassandra.client);
	}

	cassandra.emit('info', 'Starting Cassandra with options: ' + options);
	resolveOptions(options)
		// start the server
		.then(function(merged) {
			child = childProcess.spawn(path.join(__dirname, 'apache-cassandra-2.1.0', 'bin', 'cassandra'), ['-f']);

			// error handler
			child.on('error', function(err) {
				var error = new Error('Cassandra process error');
				error.cause = err;
				cassandra.emit('error', error);

				// if we're starting up
				if(timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = undefined;
					deferred.reject(error);
				}
			});

			// exit handler
			child.on('exit', function(code) {
				cassandra.emit('info', 'Cassandra exited with code: ' + code);

				// if we're starting up
				if(timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = undefined;
					deferred.reject(new Error('Could not start Cassandra'));
				}
			});

			// stderr handler
			child.stderr.on('data', function(data) {
				cassandra.emit('stderr', data.toString());
			});

			// track the last level logged
			var lastLevel;

			// stdout listener
			child.stdout.on('data', function(data) {
				var line = data.toString(),
					isLogLine = false;

				// for each log level
				for(var index = 0; index < levels.length; index++) {
					var regexp = new RegExp('^' + levels[index], 'i');

					// if the line is prefixed by a log level
					if(line.match(regexp)) {
						lastLevel = levels[index];
						cassandra.emit(levels[index], line.replace(regexp, '').trim());
						isLogLine = true;
						break;
					}
				}

				// if not a log line then use the last level logged
				if(!isLogLine) {
					cassandra.emit(lastLevel, line.trim());
				}
			});

			// give it 5 seconds to start
			timeoutId = setTimeout(function() {
				// TODO: read this from merged options
				configureClient(['localhost']);

				// resolve the startup promise when the client connects
				cassandra.client.connect()
					.then(function() {
						timeoutId = undefined;
						cassandra.emit('info', 'Server started');
						deferred.resolve(cassandra.client);
					})
					.catch(function(err) {
						timeoutId = undefined;

						var error = new Error('Could not connect to Cassandra');
						error.cause = err;
						cassandra.emit('error', error);

						// since the client could not connect we may as well kill the server
						cassandra.stop()
							.done(function() {
								deferred.reject(error);
							});
					})
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
		cassandra.emit('info', 'Cassandra is already stopped');
		return Q();
	}

	// function to stop the server
	function doStop() {
		cassandra.emit('info', 'Stopping Cassandra');

		child.kill();
		child = cassandra.client = undefined;
		return Q();
	}

	// if the client couldn't connect
	if(!cassandra.client) {
		return doStop();
	}

	// shutdown the client
	return cassandra.client.shutdown()
		.then(doStop);
};

