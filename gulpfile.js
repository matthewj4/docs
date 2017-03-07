/*
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

'use strict';

// let gulp = require('gulp');
let gulp = require('gulp-help')(require('gulp'));
let $ = require('gulp-load-plugins')();
let matter = require('gulp-gray-matter');
let styleMod = require('gulp-style-modules');
let cssslam = require('css-slam');
let run = require('gulp-run');

let argv = require('yargs').argv;
let browserSync = require('browser-sync').create();
let del = require('del');
let fs = require('fs');
var replace = require('gulp-replace');

let markdownIt = require('markdown-it')({
    html: true,
    highlight: (code, lang) => {
      let highlightjs = require('highlight.js')
      if (lang && highlightjs.getLanguage(lang)) {
        try {
          return highlightjs.highlight(lang, code).value;
        } catch (__) { console.log(__) }
      } else {
        try {
          return highlightjs.highlightAuto(code).value;
        } catch (__) { console.log(__) }
      }

      return ''; // use external default escaping
    }
  });
let markdownItAttrs = require('markdown-it-attrs');
let merge = require('merge-stream');
let path = require('path');
let runSequence = require('run-sequence');
let toc = require('toc');

let AUTOPREFIXER_BROWSERS = ['last 2 versions', 'ios 8', 'Safari 8'];

markdownIt.use(markdownItAttrs);
// keep markdownIt from escaping template markup.
markdownIt.normalizeLink = function(link) { return link; }
markdownIt.validateLink = function(link) { return true; }

function minifyHtml() {
  return $.minifyHtml({quotes: true, empty: true, spare: true});
}

function uglifyJS() {
  return $.uglify({preserveComments: 'some'});
}

function license() {
  return $.license('BSD2', {
    organization: 'The Polymer Project Authors. All rights reserved.',
    tiny: true
  });
}

// reload is a noop unless '--reload' cmd line arg is specified.
let reload = function() {
  return new require('stream').PassThrough({objectMode: true});
}

if (argv.reload) {
  reload = browserSync.reload;
}

function createReloadServer() {
  browserSync.init({
    notify: true,
    open: !!argv.open,
    proxy: 'localhost:8080' // proxy serving through app engine.
  });
}

gulp.task('style', 'Compile sass, autoprefix, and minify CSS', function() {
  let sassOpts = {
    precision: 10,
    outputStyle: 'expanded',
    onError: console.error.bind(console, 'Sass error:')
  };

  return gulp.src('app/sass/**/*.scss')
    .pipe($.changed('dist/css'))
    .pipe($.sass(sassOpts))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe($.cssmin()) // Minify and add license
    .pipe(license())
    .pipe(gulp.dest('dist/css'))
});

// gulp.task('style:modules', 'Wrap CSS in Polymer style modules', function() {
//   return gulp.src('node_modules/highlight.js/styles/github.css')
//     .pipe($.rename({basename: 'syntax-color'}))
//     .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
//     .pipe(styleMod({
//       //filename: 'syntax-color',
//       // moduleId: function(file) {
//       //   return 'syntax-color';//path.basename(file.path, path.extname(file.path)) + '-css';
//       // }
//     }))
//     .pipe(gulp.dest('dist/css'))
// });

gulp.task('images', 'Optimize images', function() {
  return gulp.src('app/images/**/*')
    .pipe($.changed('dist/images'))
    .pipe($.imagemin({
      progressive: true,
      interlaced: true,
      svgoPlugins: [{convertTransform: false}]
    }))
    .pipe(gulp.dest('dist/images'));
});

function convertMarkdownToHtml(file, templateName) {
  let data = file.data;
  data.file = file;
  data.content = markdownIt.render(file.content); // Markdown -> HTML.
  data.title = data.title || '';
  data.subtitle = data.subtitle || '';

  // If there is a table of contents, toc-ify it. Otherwise, wrap the
  // original markdown content anyway, so that we can style it.
  if (data.content.match(/<!--\s*toc\s*-->/gi)) {
    // Leave a trailing opening <div class="article-wrapper"><article> in the TOC, so that we can wrap the original
    // markdown content into a div, for styling
    data.content = toc.process(data.content, {
      header: '<h<%= level %><%= attrs %> id="<%= anchor %>" class="has-permalink"><%= header %></h<%= level %>>',
      TOC: '<div class="details-wrapper"><details id="toc"><summary>Contents</summary><%= toc %></details></div><div class="article-wrapper"><article>',
      openUL: '<ul data-depth="<%= depth %>">',
      closeUL: '</ul>',
      openLI: '<li data-level="H<%= level %>"><a href="#<%= anchor %>"><%= text %></a>',
      closeLI: '</li>',
      tocMax: 3,
      anchor: function(header, attrs) {
        // if we have an ID attribute, use that, otherwise
        // use the default slug
        var id = attrs.match(/(?:^|\s+)id="([^"]*)"/)
        return id ? id[1] : toc.anchor(header);
      }
    }) + '</article></div>';
  } else {
    data.content = '<div class="article-wrapper"><article>' + data.content + '</article></div>';
  }

  $.util.replaceExtension(file, '.html'); // file.md -> file.html

  let tmpl = fs.readFileSync(templateName);
  let renderTemplate = $.util.template(tmpl);

  return renderTemplate(data);
}

gulp.task('md:docs', 'Docs markdown -> HTML conversion. Syntax highlight and TOC generation', function() {
  return gulp.src([
      'app/**/*.md',
      '!app/blog/*.md',
      '!app/{bower_components,elements,images,js,sass}/**',
    ], {base: 'app/'})
    .pipe(matter(function(file) { // pull out front matter data.
      return convertMarkdownToHtml(file, 'templates/page.template');
    }))
    .pipe($.rename({extname: '.html'}))
    .pipe(gulp.dest('dist'));
});

gulp.task('md:blog', 'Blog markdown -> HTML conversion. Syntax highlight and TOC generation', function() {
  return gulp.src([
      'app/blog/*.md',
    ], {base: 'app/'})
    .pipe(matter(function(file) { // pull out front matter data.
      return convertMarkdownToHtml(file, 'templates/blog.template');
    }))
    .pipe($.rename({extname: '.html'}))
    .pipe(gulp.dest('dist'));
});

// // Minify html
// gulp.task('html', function() {
//   gulp.src('app/index.html')
//     //.pipe($.changed('dist/index.html'))
//     .pipe(minifyHtml())
//     .pipe(gulp.dest('dist'));
// });

gulp.task('jshint', 'Lint JS', function() {
  return gulp.src([
      'gruntfile.js',
      'app/js/**/*.js',
      'app/elements/**/*.js',
      'app/elements/**/*.html'
    ])
    .pipe($.changed('dist/js'))
    .pipe($.jshint.extract()) // Extract JS from .html files
    .pipe($.jshint({esnext: true}))
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

gulp.task('js', 'Minify JS to dist/', ['jshint'], function() {
  return gulp.src(['app/js/**/*.js'])
    .pipe(uglifyJS()) // Minify js output
    .pipe(gulp.dest('dist/js'));
});

gulp.task('build-bundles', 'Build element bundles', function() {
  return run('polymer build').exec();
});

// Dear reader, know this: I am sorry for what you're about to read, but
// the bleeding edge is bloody and first paint is kind of a Big Deal™.

// TODO: This is a giant hack because a bug in `polymer build` means it
// does not minify bundles. This shouldn't be needed at all once that is fixed.
// See https://github.com/Polymer/polymer-build/issues/110.
gulp.task('minify-bundles', 'Minify element bundles',  ['build-bundles'], function() {
  return gulp.src('build/default/app/elements/*')
    .pipe($.crisper({scriptInHead: false})) // split inline JS & CSS out into individual .js & .css files
    .pipe($.if('*.html', minifyHtml())) // Minify html output
    .pipe($.if('*.html', cssslam.gulp())) // Minify css in HTML output
    // .pipe($.if('*.js', uglifyJS())) // Minify js output
    .pipe($.if('*.js', license()))
    .pipe(gulp.dest('build/minified'));
});

// Another giant hack: crisper splits the js away into a separate file,
// which is bad for pw-shell because it delays first paint (the js doesn't
// start downloading until the html finishes) so we're going to do what
// the bundler should have done in the first place, and insert the js
// contents inline.
gulp.task('hack-bundles', 'Hack the pw-shell import', ['build-bundles', 'minify-bundles'], function() {
  return gulp.src('./build/minified/pw-shell.html')
    .pipe(replace('<script src="pw-shell.js"></script>',
                  '<script>' + fs.readFileSync('./build/minified/pw-shell.js', 'utf8') + '</script>'))
    .pipe(gulp.dest('./build/minified'));
});

gulp.task('vulcanize-demos', 'vulcanize demos', function() {
  return gulp.src('app/1.0/homepage/*/index.html', {base: 'app/1.0/homepage'})
    .pipe($.vulcanize({
      stripComments: true,
      inlineCss: true,
      inlineScripts: true
    }))
    .pipe($.crisper()) // Separate HTML/JS into separate files.
    .pipe($.if('*.html', minifyHtml())) // Minify html output
    .pipe($.if('*.html', cssslam.gulp())) // Minify css in HTML output
    .pipe($.if('*.js', uglifyJS())) // Minify js output
    .pipe($.if('*.js', license()))
    .pipe(gulp.dest('dist/1.0/homepage'));
});

gulp.task('copy', 'Copy site files (polyfills, templates, etc.) to dist/', function() {
  let app = gulp.src([
      '*',
      'app/manifest.json',
      '!{README.md,package.json,gulpfile.js,test_runner.py}',
    ], {nodir: true})
    .pipe(gulp.dest('dist'));

  let docs = gulp.src([
      'app/**/*.html',
      'app/**/nav.yaml',
      'app/**/blog.yaml',
      'app/**/authors.yaml',
      '!app/{bower_components,elements}/**',
      '!app/1.0/homepage/**',
     ], {base: 'app/'})
    .pipe(gulp.dest('dist'));

  let gae = gulp.src([
      '{templates,lib}/**/*'
     ])
    .pipe(gulp.dest('dist'));

  let bower = gulp.src([
      'app/bower_components/webcomponentsjs/webcomponents*.js'
    ], {base: 'app/'})
    .pipe(gulp.dest('dist'));

  let highlight = gulp.src([
      'node_modules/highlight.js/lib/*'
    ])
    .pipe(gulp.dest('dist/bower_components/highlight'));

  // Copy the bundles that polymer build produced.
  // TODO: Change this to 'build/default/app/elements/*' when `polymer build` is
  // fixed and it minifies bundles. See https://github.com/Polymer/polymer-build/issues/110.
  let bundles = gulp.src([
      'build/minified/*'
    ])
    .pipe(gulp.dest('dist/elements'));

  let summit = gulp.src([
      'app/summit*/**/*',
      'app/summit*/*',
    ], {base: 'app'})
    .pipe(gulp.dest('dist'));

  let bower_summit = gulp.src([
      'app/bower_components/webcomponentsjs/webcomponents*.js'
    ], {base: 'app/'})
    .pipe(gulp.dest('dist/summit-2015'))
    .pipe(gulp.dest('dist/summit-2016'));

  return merge(app, docs, gae, bower, highlight, bundles, summit, bower_summit);
});

gulp.task('watch', 'Watch files for changes', function() {
  createReloadServer();
  gulp.watch('app/sass/**/*.scss', ['style', reload]);
  gulp.watch('app/elements/**/*', function() {
    runSequence('hack-bundles', 'copy');
    reload();
  });
  gulp.watch('app/js/*.js', ['js', reload]);

  gulp.watch('app/blog/*.md', ['md:blog', reload]);
  gulp.watch('app/**/*.md', ['md:docs', reload]);
  gulp.watch(['templates/*.html', 'app/**/*.html'], ['copy', reload]);
  // Watch for changes to server itself.
  gulp.watch('*.py', function(files) {
    gulp.src('*.py').pipe(gulp.dest('dist'));
    reload();
  });
  gulp.watch('*.{yaml,yml}', function(files) {
    gulp.src('*.{yml,yaml}').pipe(gulp.dest('dist'));
    reload();
  });
}, {
  options: {
    'reload': 'Reloads browser tab when watched files change',
    'open': 'Opens a browser tab when launched'
  }
});

gulp.task('clean', 'Remove dist/ and other built files', function() {
  return del(['dist', 'app/css']);
});

// Default task. Build the dest dir.
gulp.task('default', 'Build site', ['clean', 'jshint'], function(done) {
  runSequence(
    'hack-bundles',
    ['style', 'images', 'vulcanize-demos', 'js'],
    'copy', 'md:docs', 'md:blog',
    done);
});
