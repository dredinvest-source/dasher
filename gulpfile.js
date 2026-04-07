// Load plugins
const { src, dest, watch, parallel, series } = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const gulpautoprefixer = require('gulp-autoprefixer');
const browsersync = require('browser-sync').create();
const fileinclude = require('gulp-file-include');
const useref = require('gulp-useref');
const cached = require('gulp-cached');
const gulpIf = require('gulp-if');
const del = require('del');
const npmDist = require('gulp-npm-dist');
const postcss = require('gulp-postcss');
const cssnano = require('cssnano');
const autoprefixer = require('autoprefixer');
const replace = require('gulp-replace');
const gulpTerser = require('gulp-terser');
const uglify = require('gulp-uglify');

// Paths to project folders
const paths = {
  base: {
    base: './',
    node: './node_modules',
  },
  src: {
    basesrc: './src',
    scss: './src/assets/scss/**/*.scss',
    css: './src/assets/css',
    js: './src/assets/js/**/*.js', // Всі JS файли
    vendorJs: './src/assets/js/vendors/*.js',
    appJs: './src/assets/js/app/**/*.js', // ТВОЯ ПАПКА APP
    html: './src/**/*.html',
    images: './src/assets/images/**/*',
    maps: './src/assets/maps/**/*',
    fonts: './src/assets/fonts/**/*',
  },
  dist: {
    basedist: './dist',
    js: './dist/assets/js',
    appJs: './dist/assets/js/app', // Куди копіювати додаток
    vendorJs: './dist/assets/js/vendors',
    images: './dist/assets/images',
    css: './dist/assets/css',
    fonts: './dist/assets/fonts',
    libs: './dist/assets/libs',
    maps: './dist/assets/maps',
  },
};

// SCSS to CSS
function scss() {
  return src(paths.src.scss)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulpautoprefixer())
    .pipe(dest(paths.src.css))
    .pipe(browsersync.stream());
}

// Vendor JS
function vendorJs() {
  return src(paths.src.vendorJs)
    .pipe(uglify())
    .pipe(dest(paths.dist.vendorJs));
}

// --- НОВИЙ ТАСК: App Scripts ---
// Він копіює і мініфікує файли з js/app/
function scripts() {
  return src(paths.src.appJs)
    .pipe(gulpTerser()) // стискаємо код
    .pipe(dest(paths.dist.appJs)); // зберігаємо структуру папок
}

// Таск для головного файлу main.js (якщо він у корені js)
function mainJs() {
  return src('./src/assets/js/main.js', { allowEmpty: true })
    .pipe(gulpTerser())
    .pipe(dest(paths.dist.js));
}

// Image
function images() {
  return src(paths.src.images, { encoding: null, buffer: true })
    .pipe(dest(paths.dist.images));
}

// Maps
function maps() {
  return src(paths.src.maps, { encoding: null, buffer: true })
    .pipe(dest(paths.dist.maps));
}

// Fonts
function fonts() {
  return src(paths.src.fonts).pipe(dest(paths.dist.fonts));
}

// HTML
function html() {
  return src([paths.src.html, '!./src/partials/**/*'])
    .pipe(fileinclude({ prefix: '@@', basepath: '@file' }))
    .pipe(replace(/src="(.{0,10})node_modules/g, 'src="$1assets/libs'))
    .pipe(replace(/href="(.{0,10})node_modules/g, 'href="$1assets/libs'))
    .pipe(useref({ searchPath: ['src', '.'] }))
    // ПРИБРАНО cached() для білду, щоб завжди бачити зміни
    .pipe(gulpIf('*.css', postcss([autoprefixer(), cssnano()])))
    .pipe(gulpIf('*.js', gulpTerser()))
    .pipe(dest(paths.dist.basedist));
}

// Copy libs
function copyLibs() {
  return src(npmDist(), { base: paths.base.node }).pipe(dest(paths.dist.libs));
}

// Clean
function cleanDist(done) {
  del.sync(paths.dist.basedist);
  done();
}

// Watch Task
function watchTask() {
  browsersync.init({
    server: { baseDir: [paths.src.basesrc, './'] },
  });
  watch(paths.src.html, series(html, browsersync.reload));
  watch(paths.src.scss, series(scss, browsersync.reload));
  watch(paths.src.appJs, series(scripts, browsersync.reload));
}

// --- Експорт тасків ---
exports.build = series(
  cleanDist, 
  parallel(html, scripts, mainJs, images, maps, fonts, vendorJs, copyLibs) // supabase.js більше не потрібен
);

exports.default = series(scss, html, watchTask);