export default {
  test: {
    environment: 'node',
    include: ['scripts/**/*.test.mjs'],
    testTimeout: 20_000
  }
}
