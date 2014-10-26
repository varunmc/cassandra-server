# Cassandra-Server #
_A thin Javascript wrapper around [Apache Cassandra][apache-cassandra] to provide out of the box server support_

* [Introduction](#introduction)
* [Requirements](#requirements)
* [Installation](#installation)

# Introduction #
Control a local Cassandra server with Javascript. Typical server lifecycle methods are included (start, stop, restart) along with other convenience methods.

This module comes bundled with Cassandra v2.1.0 which works with Cassandra Query Language v3.1 ([CQL3][cql3]) and Cassandra's native protocol.

# Requirements #
Cassandra v2.x works with [Java7][java7] or higher and it must be installed and available on the PATH prior to starting the server.

# Installation #
```sh
$ npm install cassandra-server
```
[![NPM version][npm-image]][npm-url]

[apache-cassandra]: http://cassandra.apache.org
[cql3]: http://www.datastax.com/documentation/cql/3.1/cql/cql_intro_c.html
[java7]: http://www.oracle.com/technetwork/java/javase/downloads/jdk7-downloads-1880260.html
[npm-image]: http://img.shields.io/npm/v/cassandra-server.svg?style=flat
[npm-url]: https://npmjs.org/package/cassandra-server
