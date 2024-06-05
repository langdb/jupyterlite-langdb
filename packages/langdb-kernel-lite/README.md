# langdb-kernel-lite

A jupyter lite kernel for LangDB.

## Install

```bash
pip install git+https://github.com/langdb/langdb-kernel-lite.git
```
To build using jupyter lite

```bash
jupyter lite build
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall langdb-kernel-lite
```

## Contributing

### Development install
```bash
# Clone the repo to your local environment
# Change directory to the langdb-kernel-lite directory
# Install package in development mode
python -m pip install -e .

# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite

# Rebuild extension Typescript source after making changes
yarn run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
yarn run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).


### Development uninstall

```bash
pip uninstall langdb-kernel-lite
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `@jupyterlite/langdb-kernel` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
