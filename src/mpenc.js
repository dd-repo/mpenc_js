/*
 * Created: 11 Feb 2014 Guy K. Kloss <gk@mega.co.nz>
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
    "mpenc/version",
    "mpenc/session",
    "mpenc/message",
    "mpenc/channel",
    "mpenc/greet/greeter",
    "mpenc/impl/session",
    "mpenc/impl/transcript",
    "mpenc/helper/async",
    "mpenc/helper/struct",
    "megalogger"
], function(
    version, session, message, channel,
    greeter, sessionImpl, transcriptImpl,
    async, struct, MegaLogger
) {
    "use strict";

    /**
     * @exports mpenc
     * @description
     * The multi-party encrypted chat protocol, public API.
     * This is eventually to be extended towards the mpOTR standard, currently
     * under development.
     *
     * @property version {string}
     *     Member's identifier string.
     */
    var mpenc = {};

    // Create the name space's root logger.
    MegaLogger.getLogger('mpenc');

    // Create two more loggers for name spaces without their own modules.
    MegaLogger.getLogger('helper', undefined, 'mpenc');
    MegaLogger.getLogger('greet', undefined, 'mpenc');

    mpenc.version = version;


    /**
     * Create a new timer to run scheduled tasks.
     *
     * There should only be one of these in the entire application.
     *
     * @returns {module:mpenc/helper/async.Timer}
     * @memberOf module:mpenc
     */
    var createTimer = function() {
        return new async.Timer();
    };
    mpenc.createTimer = createTimer;


    /**
     * Create a new context for sessions.
     *
     * There should only be one of these per user, shared between all their
     * sessions.
     *
     * @param userId {string}
     *      Global identifier for the local user.
     * @param timer {module:mpenc/helper/async.Timer}
     *      Timer; see {@link module:mpenc.createTimer}.
     * @returns {module:mpenc/impl/session.SessionContext}
     * @memberOf module:mpenc
     */
    var createContext = function(userId, timer) {
        // TODO: estimated 95-percentile values, tweak these later
        var flowControl = {
            getBroadcastLatency: function() {
                // 5 seconds to broadcast (half-round-trip) to *everyone*
                return 5000;
            },
            getFullAckInterval: function() {
                // 16 seconds to reply to a message
                return 16000 + 2 * this.getBroadcastLatency();
            },
            asynchronity: function() {
                // 4 messages "in transit" on the wire
                return 4;
            },
        };
        return new sessionImpl.SessionContext(
            userId, false, timer, flowControl,
            message.DefaultMessageCodec,
            transcriptImpl.DefaultMessageLog);
    };
    mpenc.createContext = createContext;


    /**
     * Create a new group session.
     *
     * @param context {module:mpenc/impl/session.SessionContext}
     *      Session context; see {@link module:mpenc.createContext}.
     * @param sessionId {string}
     *      A unique identifier for this session, constant across all members.
     * @param groupChannel {module:mpenc/channel.GroupChannel}
     *      Group transport client / adapter object, for the session to be able
     *      to communicate with the outside world.
     * @param privKey {string}
     *      The long-term Ed25519 private key for the local user.
     * @param pubKey {string}
     *      The long-term Ed25519 public key for the local user.
     * @param pubKeyDir {{get: function}}
     *      Object with a 1-arg "get" method for obtaining long-term Ed25519
     *      public keys for other members.
     * @returns {module:mpenc/impl/session.HybridSession}
     * @memberOf module:mpenc
     */
    var createSession = function(context, sessionId, groupChannel, privKey, pubKey, pubKeyDir) {
        return new sessionImpl.HybridSession(
            context, sessionId, groupChannel,
            new greeter.Greeter(context.owner, privKey, pubKey, pubKeyDir),
            message.MessageSecurity);
    };
    mpenc.createSession = createSession;


	// expose some utilities to help external implementations of GroupChannel
    mpenc.helper = {
        'async': async,
        'struct': struct
    };
    mpenc.channel = channel;


    return mpenc;
});
