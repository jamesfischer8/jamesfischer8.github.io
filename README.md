# Development
Install the Ruby gems first:
```
bundle install
```

Install wrangler globally as well:
```
npm install -g wrangler
```

For working on the static site, run:
```
bundle exec jekyll serve
```

For working on the Cloudflare Worker, run (in separate panes):
```
bundle exec jekyll build --watch

npx wrangler pages dev
```
