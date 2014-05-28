# Build directory.
BUILDDIR = build

# Libraries to omit when building mpenc-partial.js.
PARTIAL_OMIT = asmcrypto curve255 jsbn jsbn2 ed25519

# Set to none for a non-minified build, for easier debugging.
OPTIMIZE = uglify

KARMA  = ./node_modules/.bin/karma
JSDOC  = ./node_modules/.bin/jsdoc
R_JS   = ./node_modules/.bin/r.js
ALMOND = ./node_modules/almond/almond
R_JS_ALMOND_OPTS = baseUrl=src name=../$(ALMOND) wrap.startFile=almond.0 wrap.endFile=almond.1

all: test build-full build-test-full

test: $(KARMA)
	$(KARMA) start --singleRun=true karma.conf.js --browsers PhantomJS

api-doc: $(JSDOC)
	$(JSDOC) --destination doc/api/ --private \
                 --configure jsdoc.json \
                 --recurse src/

$(BUILDDIR)/build-config-full.js: src/config.js Makefile
	mkdir -p $(BUILDDIR)
	tail -n+2 "$<" > "$@"

$(BUILDDIR)/build-config-partial.js: src/config.js Makefile
	mkdir -p $(BUILDDIR)
	tail -n+2 "$<" > "$@.tmp"
	for i in $(PARTIAL_OMIT); do \
		sed -i -e "s,lib/$$i\",build/$$i-dummy\"," "$@.tmp"; \
		touch $(BUILDDIR)/$$i-dummy.js; \
	done
	mv "$@.tmp" "$@"

build-full: $(R_JS) $(BUILDDIR)/build-config-full.js
	$(R_JS) -o $(BUILDDIR)/build-config-full.js out="$(BUILDDIR)/mpenc-full.js" \
	  $(R_JS_ALMOND_OPTS) include=mpenc optimize=$(OPTIMIZE)

build-partial: $(R_JS) $(BUILDDIR)/build-config-partial.js
	$(R_JS) -o $(BUILDDIR)/build-config-partial.js out="$(BUILDDIR)/mpenc-partial.js" \
	  $(R_JS_ALMOND_OPTS) include=mpenc optimize=$(OPTIMIZE)

build-test-full: test/build-test-full.js build-full
	./$< ../$(BUILDDIR)/mpenc-full.js

build-test-partial: test/build-test-partial.js build-partial
	./$< ../$(BUILDDIR)/mpenc-partial.js $(PARTIAL_OMIT)

$(KARMA) $(JSDOC) $(R_JS):
	npm install

clean:
	rm -rf doc/api/ coverage/ build/

.PHONY: test api-doc clean
.PHONY: build-full build-partial build-test-full build-test-partial
