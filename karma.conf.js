// Karma configuration.

module.exports = function(config) {
  config.set({
    // base path, that will be used to resolve files and exclude
    basePath: '',

    // frameworks to use
    frameworks: ['requirejs', 'mocha', 'chai', 'sinon'],

    // list of files / patterns to load in the browser
    // {included: false} files are loaded by requirejs
    files: [
        // Dependency-based load order of lib/ modules.
        'lib/curve255.js',
        'lib/jsbn.js',
        'lib/jsbn2.js',
        'lib/ed25519.js',
        'lib/asmcrypto.js',
        // karma-sinon does not yet integrate with requirejs, so we have to do this hack
        {pattern: 'node_modules/sinon/lib/**/*.js', included: false},

        // ours
        'src/config.js',
        {pattern: 'src/**/*.js', included: false},
        'test/test_data.js',
        'test/test_utils.js',
        {pattern: 'test/**/*_test.js', included: false},
        'test/test_main.js',
    ],

    // list of files to exclude
    exclude: [
    ],

    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
    reporters: ['progress', 'coverage'],

    // Source files to generate a coverage report for.
    // (Do not include tests or libraries.
    // These files will be instrumented by Istanbul.)
    preprocessors: {
        'src/**/*.js': ['coverage']
    },

    // Coverage configuration
    coverageReporter: {
        type: 'html',
        dir: 'coverage/'
    },

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera (has to be installed with `npm install karma-opera-launcher`)
    // - Safari (only Mac; has to be installed with `npm install karma-safari-launcher`)
    // - PhantomJS
    // - IE (only Windows; has to be installed with `npm install karma-ie-launcher`)
    browsers: ['Firefox', 'Chrome'],

    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 120000,
//    browserDisconnectTimeout: 6000,
//    browserDisconnectTolerance: 2,
//    browserNoActivityTimeout: 60000,

    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: false
  });
};

