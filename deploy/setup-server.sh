#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu server (Oracle Cloud Ampere, 22.04/24.04):
# Docker, the firewall ports for HTTPS, automatic security updates.
#   sudo bash deploy/setup-server.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo." >&2; exit 1; fi

# Docker Engine + compose plugin (official convenience script).
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
user="${SUDO_USER:-ubuntu}"
usermod -aG docker "$user"

# Oracle's Ubuntu images block everything but SSH in iptables (on top of the
# VCN security list) - open 80 and 443 and keep the rules across reboots.
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent unattended-upgrades
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 6 -p tcp --dport "$port" -j ACCEPT
done
iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
netfilter-persistent save

# Security updates install themselves (reboots stay manual).
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "Done. Log out and back in (docker group), then see deploy/README.md."
