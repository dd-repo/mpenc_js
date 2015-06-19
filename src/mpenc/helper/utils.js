/*
 * Created: 7 Feb 2014 Guy K. Kloss <gk@mega.co.nz>
 *
 * (c) 2014-2015 by Mega Limited, Auckland, New Zealand
 *     http://mega.co.nz/
 *
 * This file is part of the multi-party chat encryption suite.
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation. See the accompanying
 * LICENSE file or <https://www.gnu.org/licenses/> if it is unavailable.
 *
 * This code is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

define([
    "asmcrypto",
    "jodid25519",
    "megalogger",
], function(asmCrypto, jodid25519, MegaLogger) {
    "use strict";

    /**
     * @exports mpenc/helper/utils
     * @description
     * Some utilities.
     */
    var ns = {};

    var logger = MegaLogger.getLogger('utils', undefined, 'helper');

    ns._HEX_CHARS = '0123456789abcdef';

    // The following are JSDoc typedefs
    // They may be referred to as {module:mpenc/helper/utils~$name}

    /**
     * Raw transport-layer data to be sent.
     * @typedef {Object} RawSend
     * @property pubtxt {string} Raw data to send
     * @property recipients {module:mpenc/helper/struct.ImmutableSet}
     *      Transport-layer recipient addresses to send to.
     */

    /**
     * Raw transport-layer data that was received.
     * @typedef {Object} RawRecv
     * @property pubtxt {string} Raw data that was received.
     * @property sender {string}
     *      Transport-layer unauthenticated sender address we received from.
     */

    /**
     * 1-arg function to get some "associates" of a subject.
     * @callback associates
     * @param subj {}
     * @returns {Array} list of associates
     */

    /**
     * 1-arg function to decide something about a subject.
     * @callback predicate
     * @param subj {}
     * @returns {boolean}
     */

    /**
     * Generates a new random key, and converts it into a format that
     * the Ed25519 implementation understands.
     *
     * @param bits {integer}
     *     Number of bits of key strength (must be a multiple of 32).
     * @returns {array}
     *     8 bit value array of the key.
     * @private
     */
    ns._newKey08 = function(bits) {
        var buffer = new Uint8Array(Math.floor(bits / 8));
        asmCrypto.getRandomValues(buffer);
        var result = [];
        for (var i = 0; i < buffer.length; i++) {
            result.push(buffer[i]);
        }
        return result;
    };


    /**
     * Dumb array maker/initialiser helper.
     *
     * @param size {integer}
     *     Size of new array.
     * @param template
     *     Default value to initialise every element with.
     * @returns {array}
     *     The new array.
     */
    ns.arrayMaker = function(size, template) {
        var arr = new Array(size);
        for (var i = 0; i < size; i++) {
            arr[i] = template;
        }
        return arr;
    };


    /**
     * Checks for unique occurrence of all elements within the array.
     *
     * Note: Array members must be directly comparable for equality
     * (g. g. numbers or strings).
     *
     * @param theArray {integer}
     *     Array under scrutiny.
     * @returns {boolean}
     *     True for uniqueness.
     * @private
     */
    ns._arrayIsSet = function(theArray) {
        // Until ES6 is down everywhere to offer the Set() class, we need to work
        // around it.
        var mockSet = {};
        var item;
        for (var i = 0; i < theArray.length; i++) {
            item = theArray[i];
            if (item in mockSet) {
                return false;
            } else {
                mockSet[item] = true;
            }
        }
        return true;
    };


    /**
     * Checks whether one array's elements are a subset of another.
     *
     * Note: Array members must be directly comparable for equality
     * (g. g. numbers or strings).
     *
     * @param subset {array}
     *     Array to be checked for being a subset.
     * @param superset {array}
     *     Array to be checked for being a superset.
     * @returns {boolean}
     *     True for the first being a subset of the second.
     * @private
     */
    ns._arrayIsSubSet = function(subset, superset) {
        // Until ES6 is down everywhere to offer the Set() class, we need to work
        // around it.
        var mockSet = {};
        var item;
        for (var i = 0; i < superset.length; i++) {
            item = superset[i];
            if (item in mockSet) {
                return false;
            } else {
                mockSet[item] = true;
            }
        }
        for (var i = 0; i < subset.length; i++) {
            if (!(subset[i] in mockSet)) {
                return false;
            }
        }
        return true;
    };


    /**
     * Determines whether the list contains duplicates while excluding removed
     * elements (null).
     *
     * @param aList {array}
     *     The list to check for duplicates.
     * @returns {boolean}
     *     True for no duplicates in list.
     * @private
     */
    ns._noDuplicatesInList = function(aList) {
        var listCheck = [];
        for (var i = 0; i < aList.length; i++) {
            if (aList[i] !== null) {
                listCheck.push(aList[i]);
            }
        }
        return ns._arrayIsSet(listCheck);
    };


    /**
     * Returns a binary string representation of the SHA-256 hash function.
     *
     * @param data {string}
     *     Data to hash.
     * @returns {string}
     *     Binary string.
     */
    ns.sha256 = function(data) {
        return jodid25519.utils.bytes2string(asmCrypto.SHA256.bytes(data));
    };


    /**
     * (Deep) clones a JavaScript object.
     *
     * Note: May not work with some objects.
     *
     * See: http://stackoverflow.com/questions/728360/most-elegant-way-to-clone-a-javascript-object
     *
     * @param obj {object}
     *     The object to be cloned.
     * @returns {object}
     *     A deep copy of the original object.
     */
    ns.clone = function(obj) {
        // Handle the 3 simple types, and null or undefined.
        if (null === obj || "object" !== typeof obj) {
            return obj;
        }

        // Handle date.
        if (obj instanceof Date) {
            var copy = new Date();
            copy.setTime(obj.getTime());
            return copy;
        }

        // Handle array.
        if (obj instanceof Array) {
            var copy = [];
            for (var i = 0, len = obj.length; i < len; i++) {
                copy[i] = ns.clone(obj[i]);
            }
            return copy;
        }

        // Handle object.
        if (obj instanceof Object) {
            var copy = {};
            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)) {
                    copy[attr] = ns.clone(obj[attr]);
                }
            }
            return copy;
        }

        throw new Error("Unable to copy obj! Its type isn't supported.");
    };


    /**
     * Constant time string comparison of two strings.
     *
     * @param str1 {string}
     *     The first string to be compared against the second.
     * @param str2 {string}
     *     The second string to be compared against the first.
     * @returns {boolean}
     *     A true on equality.
     */
    ns.constTimeStringCmp = function(str1, str2) {
        // Compare lengths - can save a lot of time.
        if (str1.length !== str2.length) {
            return false;
        }

        var diff = 0;
        for (var i = 0, l = str1.length; i < l; i++) {
            diff |= (str1[i] ^ str2[i]);
        }
        return !diff;
    };


    /**
     * (Deep) compares two JavaScript arrays.
     *
     * See: http://stackoverflow.com/questions/7837456/comparing-two-arrays-in-javascript
     *
     * @param arr1 {array}
     *     The first array to be compared against the second.
     * @param arr2 {array}
     *     The second array to be compared against the first.
     * @returns {boolean}
     *     A true on equality.
     */
    ns.arrayEqual = function(arr1, arr2) {
        // If the other array is a falsy value, return.
        if (!arr2) {
            return false;
        }

        // Compare lengths - can save a lot of time.
        if (arr1.length !== arr2.length) {
            return false;
        }

        for (var i = 0, l = arr1.length; i < l; i++) {
            // Check if we have nested arrays.
            if (arr1[i] instanceof Array && arr2[i] instanceof Array) {
                // Recurse into the nested arrays.
                if (!ns.arrayEqual(arr1[i], arr2[i])) {
                    return false;
                }
            } else if (arr1[i] !== arr2[i]) {
                // Warning - two different object instances will never be equal: {x:20} != {x:20}
                return false;
            }
        }
        return true;
    };


    /**
     * Check an object's invariants.
     *
     * Visits all ancestor prototypes of an object (including itself) and runs
     * the 1-ary functions listed in prototype.__invariants against the object.
     */
    ns.checkInvariants = function(obj) {
        var parent = obj;
        while (parent !== Object.prototype) {
            if (parent.hasOwnProperty("__invariants")) {
                var invariants = parent.__invariants;
                for (var k in invariants) {
                    invariants[k](obj);
                }
            }
            parent = Object.getPrototypeOf(parent);
        }
    };


    /**
     * (Deep) compares two JavaScript objects.
     *
     * Note: May not work with some objects.
     *
     * See: http://stackoverflow.com/questions/7837456/comparing-two-arrays-in-javascript
     *
     * @param obj1 {object}
     *     The first object to be compared against the second.
     * @param obj2 {object}
     *     The second object to be compared against the first.
     * @returns {boolean}
     *     A true on equality.
     */
    ns.objectEqual = function(obj1, obj2) {
        // For the first loop, we only check for types
        for (var propName in obj1) {
            // Check for inherited methods and properties - like .equals itself
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty
            // Return false if the return value is different.
            if (obj1.hasOwnProperty(propName) !== obj2.hasOwnProperty(propName)) {
                return false;
            }
            // Check instance type.
            else if (typeof obj1[propName] !== typeof obj2[propName]) {
                // Different types => not equal.
                return false;
            }
        }
        // Now a deeper check using other objects property names.
        for(var propName in obj2) {
            // We must check instances anyway, there may be a property that only exists in obj2.
            // I wonder, if remembering the checked values from the first loop would be faster or not .
            if (obj1.hasOwnProperty(propName) !== obj2.hasOwnProperty(propName)) {
                return false;
            } else if (typeof obj1[propName] !== typeof obj2[propName]) {
                return false;
            }

            // If the property is inherited, do not check any more (it must be equal if both objects inherit it).
            if(!obj1.hasOwnProperty(propName)) {
                continue;
            }

            // Now the detail check and recursion.

            // This returns the script back to the array comparing.
            if (obj1[propName] instanceof Array && obj2[propName] instanceof Array) {
                // Recurse into the nested arrays.
                if (!ns.arrayEqual(obj1[propName], obj2[propName])) {
                    return false;
                }
            } else if (obj1[propName] instanceof Object && obj2[propName] instanceof Object) {
                // Recurse into another objects.
                if (!ns.objectEqual(obj1[propName], obj2[propName])) {
                    return false;
                }
            }
            // Normal value comparison for strings and numbers.
            else if(obj1[propName] !== obj2[propName]) {
                return false;
            }
        }
        // If everything passed, let's say YES.
        return true;
    };


    /**
     * The state of the state machine was invalid.
     *
     * @param actual {*} Actual invalid state
     * @param label {string} Label to describe the error-checking
     * @param expected {Array} Expected valid states
     */
    var StateError = function(actual, label, expected) {
        this._actual    = actual;
        this._label     = label;
        this._expected  = expected;
    };

    StateError.prototype = Object.create(Error.prototype);

    /**
     * Generate a string message for this error.
     */
    StateError.prototype.toString = function() {
        return 'StateError: ' +  this._label + ' expected ' +  this._expected + ' actual: ' + this._actual;
    };

    Object.freeze(StateError.prototype);
    ns.StateError = StateError;


    /**
     * A finite state machine.
     * @param changeType {function} State change factory, takes a (new, old)
     *      pair of states and returns an object.
     * @param initstate {*} Initial state of the state machine.
     */
    var StateMachine = function(changeType, initstate) {
        this._state = initstate;
        this.ChangeType = changeType;
    };

    /**
     * Get the current state.
     * @returns {SessionState}
     */
    StateMachine.prototype.state = function() {
        return this._state;
    };

    /**
     * Set a new state.
     * @param newState {SessionState} new state to set.
     * @returns {} Object describing the state transition; the caller should
     *      publish this in some {@link module:mpenc/helper/async.EventContext}.
     */
    StateMachine.prototype.setState = function(newState) {
        var oldState = this._state;
        this._state = newState;
        return new this.ChangeType(newState, oldState);
    };

    /**
     * Decorate a function with precondition and postcondition checks on the
     * state. Use something like:
     *
     * <pre>
     * MyStatefulClass.prototype.doSomething = StateMachine.transition(
     *     [valid pre states], [valid post states], function(params) {
     *     // function body. it should set the state somewhere
     * });
     * </pre>
     */
    StateMachine.transition = function(preStates, postStates, f) {
        return function() {
            try {
                var preState = this.state();
                logger.debug("pre state:" + preState);
                if (preStates.indexOf(preState) < 0) {
                    throw new StateError(preState, "precondition", preStates);
                }
                return f.apply(this, arguments);
            } finally {
                var postState = this.state();
                logger.debug("post state:" + postState);
                if (postStates.indexOf(postState) < 0) {
                    throw new StateError(postState, "postcondition", postStates);
                }
            }
        };
    };

    Object.freeze(StateMachine.prototype);
    ns.StateMachine = StateMachine;


    // jshint -W030

    /**
     * Accepts data-to-send, and notifies about data-received. This typically
     * represents a "less abstract" component than the client.
     *
     * <pre>
     *                             +-send()-+ <<<< +--------------+
     *                             |  this  |      | upper client |
     *                             +--------+ [>>] +-(subscribed receivers)
     * </pre>
     *
     * Implementations must define the following types:
     *
     * <ul>
     * <li>SendInput, expected input into send() from the upper layer</li>
     * <li>RecvOutput, result for subscribers of onRecv() to handle</li>
     * </ul>
     *
     * @interface
     * @memberOf module:mpenc/helper/utils
     */
    var ReceivingSender = function() {
        throw new Error("cannot instantiate an interface");
    };

    /**
     * Accept things to be sent by this component.
     *
     * @param input {SendInput} input to be handled for sending.
     * @returns {boolean} Whether the input was valid and was accepted.
     * @method
     */
    ReceivingSender.prototype.send;

    /**
     * Add a subscription for receive-items generated from this component.
     *
     * @method
     * @param subscriber {module:mpenc/helper/async~subscriber} 1-arg function
     *      that takes a <code>RecvOutput</code> object, and returns a boolean
     *      that represents whether it was valid for it and accepted by it.
     * @returns {module:mpenc/helper/async~canceller}
     */
    ReceivingSender.prototype.onRecv;

    ns.ReceivingSender = ReceivingSender;


    /**
     * @interface
     * @augments module:mpenc/helper/utils.ReceivingSender
     * @memberOf module:mpenc/helper/utils
     */
    var ReceivingExecutor = function() {
        throw new Error("cannot instantiate an interface");
    };

    ReceivingExecutor.prototype = Object.create(ReceivingSender.prototype);

    /**
     * Execute an action, initated by an initial SendInput.
     *
     * The exact conditions on when the action finishes is defined by the
     * implementation.
     *
     * This may not be implemented for all inputs; the implementation should
     * specify exactly which ones. If this is implemented for a given input,
     * <code>send()</code> for that input should behave exactly the same as
     * <code>return this.execute(input) !== null</code>; if not implemented
     * then this should throw a "not implemented" error.
     *
     * @method
     * @param input {SendInput} input to be handled for sending
     * @returns {?Promise} A Promise to allow the client to detect when the
     *      action finishes. <code>null</code> if the action was not started in
     *      the first place, e.g. if the input is invalid at the current time.
     */
    ReceivingExecutor.prototype.execute;

    ns.ReceivingExecutor = ReceivingExecutor;


    /**
     * Accepts data-received, and notifies about data-to-send. This typically
     * represents a "more abstract" component than the client.
     *
     * <pre>
     * (subscribed senders)-+ [<<] +--------+
     *       | lower client |      |  this  |
     *       +--------------+ >>>> +-recv()-+
     * </pre>
     *
     * Implementations must define the following types:
     *
     * <ul>
     * <li>RecvInput, expected input into recv() from the lower layer.</li>
     * <li>SendOutput, result for subscribers of onSend() to handle.</li>
     * </ul>
     *
     * @interface
     * @memberOf module:mpenc/helper/utils
     */
    var SendingReceiver = function() {
        throw new Error("cannot instantiate an interface");
    };

    /**
     * Accept things to be received by this component.
     *
     * @param input {RecvInput} input to be handled for receiving.
     * @returns {boolean} Whether the input was valid and was accepted.
     * @method
     */
    SendingReceiver.prototype.recv;

    /**
     * Add a subscription for send-items generated from this component.
     *
     * @method
     * @param subscriber {module:mpenc/helper/async~subscriber} 1-arg function
     *      that takes a <code>SendOutput</code> object, and returns a boolean
     *      that represents whether it was valid for it and accepted by it.
     * @returns {module:mpenc/helper/async~canceller}
     */
    SendingReceiver.prototype.onSend;

    ns.SendingReceiver = SendingReceiver;

    // jshint +W030


    // polyfill for PhantomJS in our tests
    if (!Function.prototype.bind) {
      Function.prototype.bind = function(oThis) { // jshint ignore:line
        if (typeof this !== 'function') {
          // closest thing possible to the ECMAScript 5
          // internal IsCallable function
          throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
        }

        var aArgs   = Array.prototype.slice.call(arguments, 1),
            fToBind = this,
            fNOP    = function() {},
            fBound  = function() {
              return fToBind.apply(this instanceof fNOP
                     ? this
                     : oThis,
                     aArgs.concat(Array.prototype.slice.call(arguments)));
            };

        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP(); // jshint ignore:line

        return fBound;
      };
    }


    return ns;
});
