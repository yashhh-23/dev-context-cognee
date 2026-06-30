#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if command -v python3 &>/dev/null; then
    python3 "$DIR/install.py"
else
    python "$DIR/install.py"
fi
