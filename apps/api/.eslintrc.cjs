module.exports = {
  root: true,
  // ESLint 8's config resolver doesn't honor package.json "exports", so resolve
  // the preset to an absolute path via Node (which does) and extend that.
  extends: [require.resolve('@fbclone/config/eslint-preset.cjs')],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
