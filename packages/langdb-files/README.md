# langdb_files

[![Github Actions Status](https://github.com/langdb/langdb-files/workflows/Build/badge.svg)](https://github.com/langdb/langdb-files/actions/workflows/build.yml)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/langdb/langdb-files/main?urlpath=lab)


Langdb Files extension

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install langdb_files
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall langdb_files
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `yarn` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `yarn` below.

```bash
# Clone the repo to your local environment
# Change directory to the langdb_files directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
yarn build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
yarn watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `yarn build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall langdb_files
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `langdb-files` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
