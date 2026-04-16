#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DIR")"

echo "Installing systemd services..."

NODE_SERVICE_FILE="/etc/systemd/system/aiclient-node.service"
PYTHON_SERVICE_FILE="/etc/systemd/system/aiclient-python.service"

if [ "$(id -u)" != "0" ]; then
    echo "Please run this script as root (sudo)"
    exit 1
fi

cat > "$NODE_SERVICE_FILE" << EOF
[Unit]
Description=AI Client Node.js API Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$ROOT_DIR
ExecStart=$ROOT_DIR/scripts/start-node.sh
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

cat > "$PYTHON_SERVICE_FILE" << EOF
[Unit]
Description=AI Client Python Controller Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$ROOT_DIR/app-controller
ExecStart=$ROOT_DIR/scripts/start-python.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling services to start on boot..."
systemctl enable aiclient-node
systemctl enable aiclient-python

echo "Services installed successfully!"
echo ""
echo "To start services immediately:"
echo "  systemctl start aiclient-node"
echo "  systemctl start aiclient-python"
echo ""
echo "To check status:"
echo "  systemctl status aiclient-node"
echo "  systemctl status aiclient-python"