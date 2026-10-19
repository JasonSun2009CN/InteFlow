#!/usr/bin/env bash
# macOS：在 Finder 里双击本文件即可一键启动 InteFlow。
#
# .command 双击运行时不会读你的 shell 配置（~/.zshrc），因此 PATH 里可能缺少
# Homebrew 安装的 python3 / node。这里补上常见路径后再交给根目录的 start.sh。
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1

for p in /opt/homebrew/bin /opt/homebrew/sbin /usr/local/bin /usr/bin /bin; do
  case ":$PATH:" in
    *":$p:"*) ;;
    *) PATH="$p:$PATH" ;;
  esac
done
export PATH

./start.sh
code=$?

printf '\nInteFlow 已退出（退出码 %s）。按回车关闭此窗口…\n' "$code"
read -r _ || true
