# Contributing

Thank you for your interest in contributing to `vite-mix`.

## Getting started

1. Install [pre-commit](https://pre-commit.com/#install) if you don't have it:

   ```bash
   brew install pre-commit
   ```

2. Clone and install dependencies:
   ```bash
   git clone https://github.com/hugoboss17/vite-mix.git
   cd vite-mix
   npm install
   ```
   `npm install` will automatically activate the git hooks via the `prepare` script. If you had `pre-commit` installed before running `npm install`, run `pre-commit install` once manually.

## Development

```bash
npm run dev      # build in watch mode
npm run build    # one-off build
npm test         # build + run tests
```

## Submitting changes

1. Fork the repository and create a branch from `main`.
2. Make your changes and ensure `npm test` passes.
3. Open a pull request — CI must pass before merging.

## Reporting issues

Use [GitHub Issues](https://github.com/hugoboss17/vite-mix/issues) for bugs and feature requests.

For security vulnerabilities, use [GitHub private vulnerability reporting](https://github.com/hugoboss17/vite-mix/security/advisories/new) instead of opening a public issue.

## Code style

- TypeScript for all source files under `src/`
- No runtime dependencies added without discussion — keep the supply chain small
- No install scripts (`preinstall`, `postinstall`, etc.)

## License

By contributing you agree that your contributions will be licensed under the [ISC License](LICENSE).
