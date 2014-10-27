# Cassandra-Server #
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/varunmc/cassandra-server?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
_A thin Javascript wrapper around [Apache Cassandra][apache-cassandra] to provide out of the box server support_

* [Introduction](#introduction)
* [Requirements](#requirements)
* [Installation](#installation)
* [Usage](#usage)
  * [Starting the server](#starting-the-server)
  * [Stopping the server](#stopping-the-server)
  * [Other functions](#other-functions)
* [Logging](#logging)
* [Changelog](#changelog)

## Introduction ##
Control a local Cassandra server with Javascript. Typical server lifecycle methods are included (start, stop, restart) along with other convenience methods.

This module comes bundled with Cassandra v2.1.0 which works with Cassandra Query Language v3.1 ([CQL3][cql3]) and Cassandra's native protocol.

## Requirements ##
Cassandra v2.x requires that [Java7][java7] or higher be installed and available on the PATH.

## Installation ##
```sh
$ npm install cassandra-server
```
[![NPM version][npm-image]][npm-url]

## Usage ##
The Cassandra server uses [Q][q] promises to defer execution and communicate it's status to the client.

### Starting the server ###
Simply do the following to start a new Cassandra server with default options. This will create a new cluster called "Test Cluster" listening on the loopback:

```javascript
var cassandra = require('cassandra-server');
cassandra.start()
    .then(function(client) {
        // do something with the client
    })
    .catch(function(err) {
        console.error(err);
    });
```

The ```client``` returned is a _promisified_ instance of the [Datastax Cassandra driver][datastax-cassandra-driver] connected to the running server facilitating easy chaining of query promises. It is also available at ```cassandra.client``` after successful startup which is otherwise, **_undefined_**.

The start function optionally accepts an ```options``` object that overrides the defaults. The following example starts a new cluster called "My Cluster" listening on w.x.y.z leaving the remaining defaults unchanged:

```javascript
cassandra.start({
        cluster_name: "My Cluster",
        listen_address: "w.x.y.z"
    });
```

[cassandra.json][cassandra-json] provides the default configuration for the server. The file is simply a cJSON port of the standard YAML configuration that comes bundled with a typical installation.

### Stopping the server ###
Stopping the server is just as easy:

```javascript
cassandra.stop()
    .then(function() {
        // continue
    });
```

### Other functions ##

#### Nuke ####
Destroys all data in the database. This action is non-recoverable.

```javascript
cassandra.nuke()
    .then(function() {
        // continue
    });
```

#### Restart ####
Stops the server, waits three seconds and then starts it again.

```javascript
cassandra.restart()
    .then(function(client) {
        // do something with the client
    });
```

# Logging #
Cassandra is an [Event Emitter][event-emitter] that emits events in response to log messages and errors from the server. Events can be listened to using the ```on``` method like so:

```javascript
cassandra.on('eventName', function(message) {
    console.log(message);
});
```

Following is a brief synopsis of all events emitted:

### Event: 'debug' ###
_Emitted when a debug log message is available_

* **message** - the debug message

### Event: 'info' ###
_Emitted when an info log message is available_

* **message** - the info message

### Event: 'warn' ###
_Emitted when a warning log message is available_

* **message** - the warning message

### Event: 'stderr' ###
_Emitted when a log message is available on standard error_

* **message** - the error message

### Event: 'error' ###
_Emitted when an error occurred with the Cassandra process_

* **error** - the [Error][error] object

# Changelog #
Visit the [Releases][releases] page for more details.

* 1.2.0 - Converted logs into events and removed winston
* 1.1.0 - More functions, logging and documentation
* 1.0.2 - Improved logging through winston
* 1.0.1 - Bug fixes
* 1.0.0 - Initial release

[apache-cassandra]: http://cassandra.apache.org
[cql3]: http://www.datastax.com/documentation/cql/3.1/cql/cql_intro_c.html
[java7]: http://www.oracle.com/technetwork/java/javase/downloads/jdk7-downloads-1880260.html
[npm-image]: http://img.shields.io/npm/v/cassandra-server.svg?style=flat
[npm-url]: https://npmjs.org/package/cassandra-server
[q]: https://github.com/kriskowal/q
[datastax-cassandra-driver]: https://github.com/datastax/nodejs-driver
[cassandra-json]: https://cdn.rawgit.com/varunmc/cassandra-server/master/cassandra.json
[event-emitter]: http://nodejs.org/api/events.html
[error]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
[releases]: https://github.com/varunmc/cassandra-server/releases
