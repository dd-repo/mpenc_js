/*
 * Created: 2 June 2015 Michael J.L. Holmwood <mh@mega.co.nz>
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
    "mpenc/helper/struct",
    "mpenc/helper/utils",
    "mpenc/helper/assert",
    "es6-collections",
    "jodid25519",
    "megalogger"
], function(struct, utils, assert, es6_shim, jodid25519, MegaLogger) {
    "use strict";

    /**
     *
     * @exports mpenc/impl/serverorder
     * @description
     * <p>Implementation of the ServerOrder class from mpenc_py.</p>
     */
    var ns = {};

    var ImmutableSet = struct.ImmutableSet;
    var _assert = assert.assert;

    var logger = MegaLogger.getLogger('serverorder', undefined, 'greet');

    /**
     * Total order on membership operations using a server to break ties.
     *
     * See "Appendix 5: Hybrid Order" in [msg-notes] for more details.
     *
     * @class
     * @memberOf mpenc/impl/serverorder
     */
    var ServerOrder = function() {
        this.clear();
    };

    /**
     * Clear the state. Call this if you have left the channel.
     */
    ServerOrder.prototype.clear = function() {
        this.seenPrevPf = new Set();

        this.packetId = null;
        this.chainHash = null;
        this.chainUnacked = null;

        this.opInitial = null;
        this.opMetadata = null;
        this.opMetadataAuthenticated = null;
        this.opFinal = null;
    };

    /**
     * @returns {string} Chain hash at the last accepted packet.
     * @throws If not yet synced.
     */
    ServerOrder.prototype.prevCh = function() {
        return this.chainHash[this.chainHash.length - 1];
    };

    /**
     * @returns {string} Packet id of the latest completed operation.
     * @throws If not yet synced.
     */
    ServerOrder.prototype.prevPf = function() {
        return this.opFinal[this.opFinal.length - 1];
    };

    /**
     * @returns {boolean} Whether we have synced with the existing server order.
     */
    ServerOrder.prototype.isSynced = function() {
        return this.seenPrevPf === null;
    };

    /**
     * @returns {boolean} Whether there is an ongoing operation.
     * @throws If not yet synced.
     */
    ServerOrder.prototype.hasOngoingOp = function() {
        return this.opInitial.length > this.opFinal.length;
    };

    /**
     * @param prevCh {string} Chain hash at the previous packet.
     * @param pId {string} Packet id of this packet.
     * @param [ptype] {string} Optional "packet type".
     * @returns {string} Chain hash at this packet.
     */
    ServerOrder.prototype.makeChainHash = function(prevCh, pId, ptype) {
        return utils.sha256(prevCh + pId + ptype);
    };

    ServerOrder.prototype._shouldSyncWith = function(pI, prevPf, forUs) {
        // whether we can accept this as the first packet for our chain
        if (!forUs) {
            logger.info("ignored " + btoa(pI) + " because it's not for us");
            return false;
        } else if (this.seenPrevPf.has(prevPf)) {
            logger.info("ignored " + btoa(pI) + " because it refers to a pF " +
                btoa(prevPf) + " for which we think an earlier pI was already accepted");
            return false;
        } else {
            return true;
        }
    };

    ServerOrder.prototype._shouldAcceptInitial = function(pId, prevPf) {
        if (this.opInitial.indexOf(pId) !== -1) {
            logger.info("rejected duplicate packet: " + btoa(pId));
            return false;
        } else if (this.hasOngoingOp()) {
            logger.info("rejected pI " + btoa(pId) + " due to pending operation " +
                        btoa(this.opInitial[this.opInitial.length - 1]));
            return false;
        } else if (this.opFinal && prevPf !== this.opFinal[this.opFinal.length - 1]) {
            logger.info("rejected pI " + btoa(pId) + " because it refers to a pF which is not the " +
                        "last accepted one " + btoa(prevPf));
            return false;
        } else {
            return true;
        }
    };

    ServerOrder.prototype._shouldAcceptFinal = function(pId, prevPi) {
        if (this.opFinal.indexOf(pId) !== -1) {
            logger.info("rejected duplicate packet: " + btoa(pId));
            return false;
        } else if (!this.hasOngoingOp()) {
            logger.info("rejected pF " + btoa(pId) + " due to completed operation " +
                        btoa(this.opFinal[this.opFinal.length - 1]));
            return false;
        } else if (prevPi !== this.opInitial[this.opInitial.length - 1]) {
            logger.info("rejected pF " + btoa(pId) + " because it refers to a pI which is not the " +
                        "last accepted one " + btoa(prevPi));
            return false;
        } else {
            return true;
        }
    };

    /**
     * Sync by generating new random values.
     */
    ServerOrder.prototype.syncNew = function() {
        var pId = jodid25519.eddsa.generateKeySeed();
        return this.syncWithPrev(pId, this.makeChainHash("", pId, "\xFF"));
    };

    /**
     * Sync opportunistically with someone else's claimed previous values.
     *
     * @param prevPf {string} Packet id of the previous final packet, before we
     *      entered the channel.
     * @param prevCh {string} Chain hash at this final packet.
     */
    ServerOrder.prototype.syncWithPrev = function(prevPf, prevCh) {
        this.seenPrevPf = null;
        this.packetId = [prevPf];
        this.chainHash = [prevCh];
        this.chainUnacked = [ImmutableSet.EMPTY];
        this.opInitial = [0];
        this.opMetadata = [null];
        this.opMetadataAuthenticated = [true];
        this.opFinal = [prevPf];
    };

    ServerOrder.prototype._acceptInitial = function(pId, metadata) {
        this.opInitial.push(pId);
        this.opMetadata.push(metadata);
        this.opMetadataAuthenticated.push(false);
    };

    ServerOrder.prototype._acceptFinal = function(pId) {
        this.opFinal.push(pId);
    };

    ServerOrder.prototype._updateServerOrder = function(pId, ptype, sessionRecipients) {
        // update our tracking of packet ids and chain hashes, and set
        // expectations that we'll verify the consistent of them with others
        this.packetId.push(pId);
        this.chainHash.push(this.makeChainHash(this.prevCh(), pId, ptype));
        this.chainUnacked.push(ImmutableSet.from(sessionRecipients));
        _assert(this.packetId.length === this.chainHash.length);
    };

    /**
     * Note that we have verified the GreetingMetadata of an operation to be
     * authenticated against its claimed sender.
     */
    ServerOrder.prototype.setMetadataAuthenticated = function(prevPf) {
        var i = this.opFinal.indexOf(prevPf);
        this.opMetadataAuthenticated[i + 1] = true;
    };

    /**
     * Try to accept or reject an initial or final packet.
     *
     * @param owner {string} Owner of the local process
     * @param op {module:mpenc/greet/greeter.GreetingSummary} Operation summary
     * @param transportRecipients {module:mpenc/helper/struct.ImmutableSet}
     *      Members (user ids) in the channel when the packet was received;
     *      includes the owner.
     * @param postAcceptInitial {function} 2-arg function called when an initial
     *      packet is accepted, taking (pI, prev_pF) packet-ids.
     * @param postAcceptFinal {function} 2-arg function called when a final
     *      packet is accepted, taking (pF, prev_pI) packet-ids.
     * @param seenExcludeUs {function} 0-arg function called if we're accepting
     *      a proposal that excludes us.
     * @returns {boolean} Whether the packet was accepted or rejected.
     */
    ServerOrder.prototype.tryOpPacket = function(
            owner, op, transportRecipients, postAcceptInitial, postAcceptFinal  ) {
        var pId = op.pId;
        var prevPf = op.isInitial() ? op.metadata.prevPf : null;
        var prevPi = op.prevPi;
        var accepted = false;
        _assert(op.isInitial() || op.isFinal());

        if (op.members.subtract(transportRecipients).size) {
            _assert(op.isInitial());
            logger.info("rejected " + btoa(pId) + " because it was not echoed to some members");
            return false;
        }

        if (!this.isSynced()) {
            if (op.isInitial()) {
                if (this._shouldSyncWith(pId, prevPf, op.members.has(owner))) {
                    this.syncWithPrev(prevPf, op.metadata.prevCh);
                } else {
                    this.seenPrevPf.add(prevPf);
                    return false;
                }
            } else {
                return false;
            }
        }

        if (op.isInitial()) {
            if (!this._shouldAcceptInitial(pId, prevPf)) {
                return false;
            }
            logger.info("accepted pI " + btoa(pId));
            this._acceptInitial(pId, op.metadata);
            postAcceptInitial(pId, prevPf);
            accepted = true;
        }

        if (op.isFinal()) {
            if (!this._shouldAcceptFinal(pId, prevPi)) {
                return false;
            }
            logger.info("accepted pF " + btoa(pId));
            this._acceptFinal(pId);
            postAcceptFinal(pId, prevPi);
            accepted = true;
        }

        _assert(this.hasOngoingOp() === (op.prevPi === null));
        this._updateServerOrder(pId, op.packetType(), op.members);
        return accepted;
    };

    ns.ServerOrder = ServerOrder;

    return ns;
});
