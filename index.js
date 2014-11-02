'use strict';

var childProcess = require('child_process'),
	Client = require('cassandra-driver').Client,
	EventEmitter = require('events').EventEmitter,
	fs = require('fs-extra'),
	path = require('path'),
	Q = require('q'),
	yaml = require('js-yaml');

// the server process
var child;

// the Cassandra client
var client;

// the Cassandra log levels
var levels = ['debug', 'info', 'warn'];

// the amount of time to wait before restarting the server
var restartWaitTime = 3000;

// the amount of time to wait before connecting the client
var startWaitTime = 5000;

/**
 * Creates a YAML configuration file after overriding defaults with user options.
 *
 * <p>
 *     Cassandra expects it's configuration to reside in $CASSANDRA_DIR/conf/cassandra.yaml.
 *     After loading the default options from cassandra.json and overriding them with user provided options,
 *     this function converts the final object to YAML and writes it to the target location.
 * </p>
 *
 * @param {Object} options - the user options
 * @private
 * @returns {Promise} - a promise that resolves to the merged server options
 */
function resolveOptions(options) {
	var jsonFileName = path.join(__dirname, 'cassandra.json');
	cassandra.emit('log', 'debug', 'Reading default configuration: ' + jsonFileName);

	return Q.nfcall(fs.readFile, jsonFileName, 'utf-8')
		.then(function(json) {
			var defaults = JSON.parse(json);

			// overriding default options
			for(var property in options) {
				if(options.hasOwnProperty(property)) {
					defaults[property] = options[property];
				}
			}
			cassandra.emit('log', 'debug', 'Resolved Cassandra options are: ' + JSON.stringify(defaults));

			var yamlFileName = path.join(__dirname, 'apache-cassandra-2.1.0', 'conf', 'cassandra.yaml');
			cassandra.emit('log', 'debug', 'Creating YAML configuration file: ' + yamlFileName);
			return Q.nfcall(fs.writeFile, yamlFileName, yaml.dump(defaults))
				.then(function() {
					return defaults;
				});
		});
}

var cassandra = Object.create(EventEmitter.prototype);
module.exports = cassandra;

/**
 * Nukes the entire database.
 * @returns {Promise}
 */
cassandra.nuke = function() {
	var deferred = Q.defer();

	// if running
	if(child) {
		var error = new Error('Cannot delete database when Cassandra is running');
		cassandra.emit('log', 'error', error);
		deferred.reject(error);
		return deferred.promise;
	}

	cassandra.emit('log', 'warn', 'Deleting all data in the database');
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
			cassandra.emit('log', 'info', 'Waiting ' + restartWaitTime + ' seconds before starting');
			setTimeout(function() {
				cassandra.start()
					.then(function(client) {
						deferred.resolve(client);
					})
					.catch(function(err) {
						deferred.reject(err);
					});
			}, restartWaitTime);
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
		cassandra.emit('log', 'info', 'Cassandra is already started');
		return deferred.resolve();
	}

	cassandra.emit('log', 'info', 'Starting Cassandra with options: ' + JSON.stringify(options));
	resolveOptions(options)
		// start the server
		.then(function(merged) {
			child = childProcess.spawn(path.join(__dirname, 'apache-cassandra-2.1.0', 'bin', 'cassandra'), ['-f']);

			// error handler
			child.on('error', function(err) {
				var error = new Error('Cassandra process error');
				error.cause = err;
				cassandra.emit('log', 'error', error);

				// if we're starting up then reject the promise
				if(timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = undefined;
					deferred.reject(error);
				}
			});

			// exit handler
			child.on('exit', function(code) {
				cassandra.emit('log', 'info', 'Cassandra exited with code: ' + code);

				// if we're starting up then reject the promise
				if(timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = undefined;
					deferred.reject(new Error('Could not start Cassandra'));
				}
			});

			// stderr handler
			child.stderr.on('data', function(data) {
				cassandra.emit('log', 'stderr', data.toString());
			});

			// track the last log level and use it for lines that don't have a log level prefix
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
						cassandra.emit('log', levels[index], line.replace(regexp, '').trim());
						isLogLine = true;
						break;
					}
				}

				// if not a log line then use the last level logged
				if(!isLogLine) {
					cassandra.emit('log', lastLevel, line.trim());
				}
			});

			// give it time to start
			timeoutId = setTimeout(function() {
				var seeds = merged.seed_provider[0].parameters[0].seeds;
				client = new Client({contactPoints: seeds});

				// resolve the startup promise when the client connects
				Q.ninvoke(client, 'connect')
					.then(function() {
						timeoutId = undefined;
						cassandra.emit('log', 'info', 'Server started');
						deferred.resolve();
					})
					.catch(function(err) {
						timeoutId = undefined;

						var error = new Error('Could not connect to Cassandra');
						error.cause = err;
						cassandra.emit('log', 'error', error);

						// since the client could not connect we may as well kill the server
						cassandra.stop()
							.done(function() {
								deferred.reject(error);
							});
					})
			}, startWaitTime);
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
		cassandra.emit('log', 'info', 'Cassandra is already stopped');
		return Q();
	}

	// function to stop the server
	function doStop() {
		cassandra.emit('log', 'info', 'Stopping Cassandra');

		child.kill();
		child = client = undefined;
		return Q();
	}

	// if the client couldn't connect
	if(!client) {
		return doStop();
	}

	// shutdown the client
	return Q.ninvoke(client, 'shutdown')
		.then(doStop);
};
