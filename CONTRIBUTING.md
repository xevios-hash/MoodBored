# Contributing to MoodBored

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/xevios-hash/MoodBored.git
cd MoodBored
npm install
npm run dev
```

## Testing

```bash
npm test          # Run all tests
npm run test:watch  # Run tests in watch mode
npm run build     # Build for production (includes type checking)
```

## Code Style

- TypeScript strict mode
- Follow existing code patterns
- Run `npm run build` before committing (includes `tsc`)

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run `npm test` and `npm run build`
6. Submit a pull request

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- Include steps to reproduce for bugs
- Check existing issues before creating new ones

## Security

See [SECURITY.md](SECURITY.md) for security vulnerability reporting.
