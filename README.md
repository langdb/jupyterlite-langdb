# JupyterLite with LangDb
```bash
poetry shell
poetry install
./build.sh

npm install -g serve
serve dist -p 8001
```

http://localhost:8001/notebooks&path=ldrive:Lorenz.ipynb


```bash
poetry run  pip uninstall -y langdb-kernel-lite langdb-files
poetry install
```