/**
 * @fileOverview
 * Test of the `mpenc/transcript` and `mpenc/impl/transcript` modules.
 */

/*
 * Created: 11 Feb 2015 Ximin Luo <xl@mega.co.nz>
 *
 * (c) 2015 by Mega Limited, Wellsford, New Zealand
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
    "mpenc/transcript",
    "mpenc/impl/transcript",
    "mpenc/helper/graph",
    "mpenc/message",
    "megalogger",
    "chai",
    "sinon/sandbox",
], function(ns, impl, graph, message, MegaLogger,
            chai, sinon_sandbox) {
    "use strict";

    var assert = chai.assert;

    var checkAdd = function(transcript, msg) {
        transcript.add(msg);
        graph.CausalOrder.checkInvariants(transcript);
    };

    var M = message.Message;

    // Create/restore Sinon stub/spy/mock sandboxes.
    var sandbox = null;

    beforeEach(function() {
        sandbox = sinon_sandbox.create();
        sandbox.stub(MegaLogger._logRegistry.transcript, '_log');
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe("BaseTranscript class", function() {
        it('empty object', function() {
            var tr = new impl.BaseTranscript();
            graph.CausalOrder.checkInvariants(tr);
            checkAdd(tr, M(0, 50, [], []));
            assert(tr.unackby(0).size === 0);
            assert(tr.unacked().length === 0);
        });

        it('smoke test, various features', function() {
            var tr = new impl.BaseTranscript();
            graph.CausalOrder.checkInvariants(tr);

            var allUId = new Set([50, 51, 52]);

            checkAdd(tr, M(0, 50, [], [51, 52]));
            checkAdd(tr, M(1, 50, [0], [51, 52]));
            checkAdd(tr, M(2, 51, [1], [50, 52]));
            checkAdd(tr, M(3, 52, [1], [50, 51]));
            checkAdd(tr, M(4, 52, [2, 3], [50, 51]));
            checkAdd(tr, M(5, 50, [3], [51, 52]));

            assert(tr.unackby(0).equals(new Set()));
            assert(tr.unackby(1).equals(new Set()));
            assert(tr.unackby(2).equals(new Set([50])));
            assert(tr.unackby(3).equals(new Set([51])));
            assert(tr.unackby(4).equals(new Set([50, 51])));
            assert(tr.unackby(5).equals(new Set([51, 52])));
            assert.deepEqual(tr.unacked(), [2, 3, 4, 5]);

            checkAdd(tr, M(6, 51, [4], [50, 52]));

            assert(tr.unackby(0).equals(new Set()));
            assert(tr.unackby(1).equals(new Set()));
            assert(tr.unackby(2).equals(new Set([50])));
            assert(tr.unackby(3).equals(new Set()));
            assert(tr.unackby(4).equals(new Set([50])));
            assert(tr.unackby(5).equals(new Set([51, 52])));
            assert(tr.unackby(6).equals(new Set([50, 52])));
            assert.deepEqual(tr.unacked(), [2, 4, 5, 6]);

            // per-author total ordering
            assert.throws(function() { tr.add(M(7, 52, [0], [50, 51])); });
            // freshness consistency
            assert.throws(function() { tr.add(M(7, 52, [0, 6], [50, 51])); });
            // parents in anti-chains (not be traversable from each other)
            assert.throws(function() { tr.add(M(7, 52, [4, 6], [50, 51])); });

            assert(tr.allAuthors().equals(allUId));
        });

        it('test that pre must be an anti-chain', function() {
            var tr = new impl.BaseTranscript();
            tr.add(M(0, 50, [], [51, 52]));
            tr.add(M(1, 51, [0], [50, 52]));
            tr.add(M(2, 52, [1], [50, 51]));
            assert(tr.le(0, 2));
            assert.throws(function() { tr.add(M(3, 52, [0, 2], [50, 51])); });
        });

        it('test that all parents must be visible', function() {
            var tr = new impl.BaseTranscript();
            tr.add(M(0, 50, [], [51, 52]));
            tr.add(M(1, 51, [0], [50, 52]));
            tr.add(M(2, 50, [0], [51]));
            assert.throws(function() { tr.add(M(3, 52, [1, 2], [50, 51])); });
        });

        it('test acks don\'t go through messages not visible to the author', function() {
            // essentially the same graph as graph_test.G_with_blocked_path
            // "blocked" nodes are nodes that weren't sent to 52
            // 52's message 0 should ack 1, 2, 4 but not 3, 5, 6 or 8
            var tr = new impl.BaseTranscript();
            tr.add(M(8, 50, [], [51, 52]));
            tr.add(M(6, 50, [8], [51]));
            tr.add(M(5, 51, [8], [50, 52]));
            tr.add(M(4, 50, [6], [51, 52]));
            tr.add(M(3, 51, [4, 5], [50]));
            tr.add(M(2, 50, [4], [51, 52]));
            tr.add(M(1, 51, [2, 3], [50, 52]));
            assert.deepEqual(tr.unacked(), [8, 5, 4, 3, 2, 1]);
            tr.add(M(0, 52, [1], [50, 51]));
            assert.deepEqual(tr.unacked(), [8, 5, 3, 1, 0]);
            assert(tr.unackby(8).equals(new Set([52])));
            assert(tr.unackby(6).equals(new Set([])));
            assert(tr.unackby(5).equals(new Set([50, 52])));
            assert(tr.unackby(4).equals(new Set([])));
            assert(tr.unackby(3).equals(new Set([50])));
            assert(tr.unackby(2).equals(new Set([])));
            assert(tr.unackby(1).equals(new Set([50])));
            assert(tr.unackby(0).equals(new Set([50, 51])));
        });


        var createHellGraph = function(halfsz) {
            // basically same as graph_test.createHellGraph
            var tr = new impl.BaseTranscript();
            tr.add(M(0, 50, [], [51]));
            tr.add(M(1, 50, [0], [51]));
            tr.add(M(2, 51, [0], [50]));
            for (var i=1; i<halfsz; i++) {
                tr.add(M(2*i+1, 50, [2*i-1, 2*i+0], [51]))
                tr.add(M(2*i+2, 51, [2*i-1, 2*i+0], [50]))
            };
            return tr;
        };

        it('test hell graph efficiency', function() {
            this.timeout(this.timeout() * 15);
            var tr = createHellGraph(256);
            graph.CausalOrder.checkInvariants(tr);
        });

        it('test no stack overflow on large transcripts graphs', function() {
            this.timeout(this.timeout() * 40);
            // pretty much same as the corresponding one in graph_test, except that
            // we also test the fact we don't explicitly need to call merge
            // incrementally, because tr.add() does that already
            var tr = createHellGraph(5000);
            assert(tr.mergeMembers([9999, 10000]).equals(new Set([50, 51])));
        });

        it('suc_ruId calculation', function() {
            var tr = new impl.BaseTranscript();
            tr.add(M(0, 50, [], [51, 52]));
            tr.add(M(1, 51, [0], [50, 52]));
            tr.add(M(2, 52, [0], [50, 51]));
            assert(tr.suc_ruId(1, 52) === null);
            assert(tr.suc_ruId(2, 51) === null);
        });
    });
});
