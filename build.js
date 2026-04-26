const nunjucks = require('nunjucks');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const { marked } = require('marked');
const sharp = require('sharp');
const sass = require('sass');

const CONTENT_DIR = path.resolve('./content');
const TEMPLATES_DIR = path.resolve('./templates');
const DIST_DIR = path.resolve('./dist');
const SRC_DIR = path.resolve('./src');

async function build() {
  console.log('Building...');

  fs.mkdirSync(path.join(DIST_DIR, 'images'), { recursive: true });
  fs.mkdirSync(path.join(DIST_DIR, 'css'), { recursive: true });

  const env = nunjucks.configure(TEMPLATES_DIR, { autoescape: true });

  const site = yaml.load(fs.readFileSync(path.join(CONTENT_DIR, 'site.yaml'), 'utf8'));
  const resume = yaml.load(fs.readFileSync(path.join(CONTENT_DIR, 'resume.yaml'), 'utf8'));
  const portfolio = loadPortfolio();

  const html = env.render('index.html', { site, resume, portfolio });
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
  console.log('  rendered index.html');

  await processImages();
  compileSCSS();

  console.log('Done.');
}

function loadPortfolio() {
  const portfolioDir = path.join(CONTENT_DIR, 'portfolio');
  return fs.readdirSync(portfolioDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const raw = fs.readFileSync(path.join(portfolioDir, f), 'utf8');
      const { data, content } = matter(raw);
      return {
        ...data,
        slug: path.basename(f, '.md'),
        content: marked(content),
      };
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

async function processImages() {
  const originalsDir = path.join(CONTENT_DIR, 'images', 'originals');
  const outDir = path.join(DIST_DIR, 'images');

  if (!fs.existsSync(originalsDir)) return;

  const files = fs.readdirSync(originalsDir).filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f));

  await Promise.all(files.map(async (file) => {
    const input = path.join(originalsDir, file);
    const name = path.basename(file, path.extname(file));
    const output = path.join(outDir, `${name}.webp`);

    if (fs.existsSync(output)) return;

    await sharp(input)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(output);

    console.log(`  image: ${file} → ${name}.webp`);
  }));
}

function compileSCSS() {
  const result = sass.compile(path.join(SRC_DIR, 'scss', 'style.scss'), {
    style: 'compressed',
  });
  fs.writeFileSync(path.join(DIST_DIR, 'css', 'style.css'), result.css);
  console.log('  compiled style.scss');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
