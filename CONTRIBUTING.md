# Contributing

Thank you for your interest in contributing to `laravel-vite-mix`.

## Getting started

```bash
git clone https://github.com/hugoboss17/laravel-vite-mix.git
cd laravel-vite-mix
npm install
```

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

Use [GitHub Issues](https://github.com/hugoboss17/laravel-vite-mix/issues) for bugs and feature requests.

For security vulnerabilities, use [GitHub private vulnerability reporting](https://github.com/hugoboss17/laravel-vite-mix/security/advisories/new) instead of opening a public issue.

## Code style

- TypeScript for all source files under `src/`
- No runtime dependencies added without discussion — keep the supply chain small
- No install scripts (`preinstall`, `postinstall`, etc.)

## License

By contributing you agree that your contributions will be licensed under the [ISC License](LICENSE).
