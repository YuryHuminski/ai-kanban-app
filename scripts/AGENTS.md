# Scripts

Start and stop scripts for the app container (name `pm-app`, port 8000).

- `start.sh` / `stop.sh` - Mac and Linux.
- `start.ps1` / `stop.ps1` - Windows (PowerShell).

`start` builds the image from the root `Dockerfile`, replaces any existing container, and runs it with `--env-file .env`. `stop` removes the container.
