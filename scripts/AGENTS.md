# Scripts

Start and stop scripts for the app container (name `pm-app`, port 8000).

- `start.sh` / `stop.sh` - Mac and Linux.
- `start.ps1` / `stop.ps1` - Windows (PowerShell).

`start` builds the image from the root `Dockerfile`, replaces any existing container, and runs it with `--env-file .env`. `stop` removes the container. It mounts the named volume `pm-data` at `/app/data` so the SQLite database survives restarts. `stop` keeps the volume; `docker volume rm pm-data` resets the data.
