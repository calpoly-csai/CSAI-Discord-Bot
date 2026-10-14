# Deployment and Cloud Monitoring

This guide describes the recommended way to run `glassic-bot` on a small Ubuntu cloud instance.

## Runtime requirements

The instance only needs this repository. The bot fetches the two upstream README files directly from GitHub and caches them locally; it does not require local clones of `Summer2027-Internships` or `New-Grad-Positions`.

Runtime-generated files are stored in ignored directories:

- `job-cache/` — cached upstream README files and metadata
- `job-output/` — generated opportunity output files

## Initial setup

Install Git, build tools, and Node.js:

```bash
sudo apt update
sudo apt install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Clone the bot repository and check out the deployment branch:

```bash
sudo mkdir -p /opt/glassic-bot
sudo chown "$USER":"$USER" /opt/glassic-bot
git clone --branch feature/new-grad-postings \
  https://github.com/calpoly-csai/CSAI-Discord-Bot.git \
  /opt/glassic-bot
cd /opt/glassic-bot
npm install
```

Create `.env` and `config.json` on the instance. Do not commit either file; they contain credentials and deployment-specific Discord IDs.

Required environment variables:

```text
DISCORD_APP_TOKEN=...
DISCORD_CLIENT_ID=...
NOTION_TOKEN=...
GOOGLE_API_KEY=...
```

Build the application:

```bash
npm run clean
npm run build
```

## Running with PM2

PM2 keeps the bot running after an SSH session ends, restarts it after a crash, and can restore it after a machine reboot.

Install and start the bot:

```bash
sudo npm install -g pm2
pm2 start build/index.js --name glassic-bot
pm2 save
pm2 startup
```

Run the `sudo ...` command printed by `pm2 startup`, then save the process list again:

```bash
pm2 save
```

Useful operational commands:

```bash
pm2 status
pm2 logs glassic-bot
pm2 restart glassic-bot
pm2 stop glassic-bot
```

Do not run a second copy of the bot in `screen`, `tmux`, or a standalone `node` process at the same time.

## Log rotation

PM2 writes application stdout and stderr logs under `~/.pm2/logs`. Install the PM2 log rotation module and retain 14 days of compressed logs:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:workerInterval 3600
```

The application also reports job summaries to the configured Discord logs channel. These PM2 settings only control files on the cloud instance.

## Updating a deployment

```bash
cd /opt/glassic-bot
git pull origin feature/new-grad-postings
npm install
npm run clean
npm run build
pm2 restart glassic-bot
pm2 save
```

After an update, check the process and recent output:

```bash
pm2 status
pm2 logs glassic-bot --lines 100
```

## Small-instance memory considerations

If Git or the TypeScript build is killed with signal 9, the instance likely ran out of memory. Check available memory and swap before retrying:

```bash
free -h
df -h
dmesg | grep -i -E 'oom|out of memory|killed process'
```

Adding swap or using a larger instance may be necessary. Do not manually delete files from `.git/objects`.
