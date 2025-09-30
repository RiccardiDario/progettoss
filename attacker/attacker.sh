set -e

# target (default interno docker)
TARGET=${1:-http://node-vuln:3000}

# cartella dove clonare il PoC
POC_DIR="/app/poc"

# se la cartella del PoC non esiste, clonala dal repo pubblico
if [ ! -d "$POC_DIR" ]; then
  mkdir -p /app
  # clona il repo ufficiale nel POC_DIR
  git clone https://github.com/lirantal/CVE-2024-27983-nodejs-http2.git "$POC_DIR"
fi

# entra nella directory del PoC
cd "$POC_DIR"

# mostra commit/branch per tracciabilità
git rev-parse --abbrev-ref HEAD || true
git log -n 1 --pretty=format:"%h %s" || true

# se il repo ha un go.mod, scarica le dipendenze Go (go mod download)
if [ -f "go.mod" ]; then
  go mod download
fi

# se il repo ha requirements.txt installa dipendenze python (non sempre necessario)
if [ -f "requirements.txt" ]; then
  pip3 install --user -r requirements.txt
fi

# output informativo: dove si trova il PoC e come avviarlo manualmente
echo "PoC pronto in: $POC_DIR"
echo "Per avviare manualmente:"
echo "  cd $POC_DIR/exploit"
echo "  go run ./exploit2.go -address http://node-vuln:3000"
