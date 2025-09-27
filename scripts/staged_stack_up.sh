#!/usr/bin/env bash
# Bring the Glyph Foundry stack up incrementally while running smoke tests.
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run this script" >&2
  exit 1
fi

if [[ -n ${COMPOSE_CMD:-} ]]; then
  # shellcheck disable=SC2206
  COMPOSE_BIN=(${COMPOSE_CMD})
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_BIN=(docker-compose)
else
  COMPOSE_BIN=(docker compose)
fi

if ! "${COMPOSE_BIN[@]}" version >/dev/null 2>&1; then
  echo "docker-compose or docker compose is required" >&2
  exit 1
fi

PYTHON_BIN=${PYTHON_BIN:-python3}
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN=python
  else
    echo "python3 (or python) is required for the local test stage" >&2
    exit 1
  fi
fi

BOOTSTRAP_PYTHON="$PYTHON_BIN"
STAGED_STACK_VENV_DIR=${STAGED_STACK_VENV_DIR:-"$ROOT_DIR/.venv/staged-stack"}

COMPOSE_FILES=(-f "$ROOT_DIR/docker-compose.yml")
for override in docker-compose.override.yml edge-ports.override.yml edge-ssl.override.yml; do
  if [[ -f "$ROOT_DIR/$override" ]]; then
    COMPOSE_FILES+=(-f "$ROOT_DIR/$override")
  fi
done

command_string() {
  local -a parts=("$@")
  local quoted=""
  local part
  for part in "${parts[@]}"; do
    if [[ -z "$quoted" ]]; then
      quoted=$(printf '%q' "$part")
    else
      quoted+=" $(printf '%q' "$part")"
    fi
  done
  printf '%s\n' "$quoted"
}

compose() {
  "${COMPOSE_BIN[@]}" "${COMPOSE_FILES[@]}" "$@"
}

compose_command_string() {
  command_string "${COMPOSE_BIN[@]}" "${COMPOSE_FILES[@]}" "$@"
}

run() {
  echo "➤ $(command_string "$@")"
  "$@"
}

run_compose() {
  echo "➤ $(compose_command_string "$@")"
  compose "$@"
}

print_staged_stack_venv_guidance() {
  cat <<'GUIDANCE' >&2
Install the python3-venv package so that Python can provision virtual environments with pip (on some distributions you may also need python3-pip), point STAGED_STACK_VENV_DIR at an existing virtual environment, or set SKIP_PIP_INSTALL=1 to skip dependency installation.
GUIDANCE
}

enforce_bootstrap_prerequisites() {
  if ! "$BOOTSTRAP_PYTHON" -c 'import ensurepip' >/dev/null 2>&1; then
    cat <<'EOF' >&2
The Python interpreter used for staged-stack bootstrapping is missing the "ensurepip" module.
EOF
    print_staged_stack_venv_guidance
    exit 1
  fi
}

ensure_local_requirements() {
  if [[ ${SKIP_PIP_INSTALL:-0} == 1 ]]; then
    return
  fi

  local venv_dir="$STAGED_STACK_VENV_DIR"
  if [[ ! -d "$venv_dir" ]]; then
    echo "Creating Python virtual environment for staged tests: $venv_dir"

    enforce_bootstrap_prerequisites
    if ! run "$BOOTSTRAP_PYTHON" -m venv "$venv_dir"; then
      cat <<'EOF' >&2
Failed to create the staged-stack virtual environment.
EOF
      print_staged_stack_venv_guidance

    if ! "$BOOTSTRAP_PYTHON" -c 'import ensurepip' >/dev/null 2>&1; then
      cat <<'EOF' >&2
The Python interpreter used for staged-stack bootstrapping is missing the "ensurepip" module.
Install the python3-venv package, point STAGED_STACK_VENV_DIR at an existing virtual environment, or set SKIP_PIP_INSTALL=1 to skip dependency installation.
EOF
      exit 1
    fi
    if ! run "$BOOTSTRAP_PYTHON" -m venv "$venv_dir"; then
      cat <<'EOF' >&2
Failed to create the staged-stack virtual environment.
Install the python3-venv package, point STAGED_STACK_VENV_DIR at an existing virtual environment, or set SKIP_PIP_INSTALL=1 to skip dependency installation.
EOF

      exit 1
    fi
  fi

  PYTHON_BIN="$venv_dir/bin/python"
  if ! "$PYTHON_BIN" -m pip --version >/dev/null 2>&1; then
    echo "Bootstrapping pip in $venv_dir"
    if ! run "$PYTHON_BIN" -m ensurepip --upgrade; then
      cat <<'EOF' >&2
Failed to bootstrap pip inside the staged-stack virtual environment.
EOF
      print_staged_stack_venv_guidance
      exit 1
    fi
    if ! "$PYTHON_BIN" -m pip --version >/dev/null 2>&1; then
      echo "virtual environment at $venv_dir is missing pip even after ensurepip" >&2
      echo "Install python3-venv (and python3-pip if required), reuse an existing environment, or export SKIP_PIP_INSTALL=1." >&2
      print_staged_stack_venv_guidance
      exit 1
    fi
  fi

  local modules=(psutil redis prometheus_client)
  local packages=()
  for module in "${modules[@]}"; do
    if "$PYTHON_BIN" -c "import ${module}" >/dev/null 2>&1; then
      continue
    fi
    case "$module" in
      prometheus_client)
        packages+=(prometheus-client)
        ;;
      *)
        packages+=("$module")
        ;;
    esac
  done
  if ((${#packages[@]})); then
    echo "Installing python dependencies for local test stage: ${packages[*]}"
    run "$PYTHON_BIN" -m pip install "${packages[@]}"
  fi
}

section() {
  local title="$1"
  echo
  echo "========================================"
  echo "${title}"
  echo "========================================"
}

check_running() {
  local service state
  for service in "$@"; do
    state=$(compose ps --format '{{.State}}' "$service" | tr -d '\r')
    if [[ -z "$state" ]]; then
      echo "service '$service' is not defined or not running" >&2
      return 1
    fi
    if [[ "$state" != "running" ]]; then
      echo "service '$service' is in state '$state'" >&2
      return 1
    fi
  done
}

# Stage 0: Local fast checks before touching containers.
section "Stage 0 ▸ Local test suite"
ensure_local_requirements
run "$PYTHON_BIN" -m compileall backend/app workers
run "$PYTHON_BIN" -m pytest workers/tests

# Stage 1: Core infrastructure dependencies.
section "Stage 1 ▸ Data plane services"
run_compose up -d --wait gf_postgres gf_redpanda minio minio_init
run_compose exec gf_postgres pg_isready -U gf_user -d glyph_foundry
run_compose exec gf_redpanda rpk cluster health
run curl -sf http://127.0.0.1:9000/minio/health/ready

# Stage 2: FastAPI backend.
section "Stage 2 ▸ Backend application"
run_compose up -d --wait backend
run_compose exec backend curl -sf http://localhost:8000/healthz

# Stage 3: Worker processes.
section "Stage 3 ▸ Worker fleet"
run_compose up -d gf_nlp_extract gf_linker_worker gf_curation_worker gf_tag_suggester gf_tag_protocol gf_layout_worker
check_running gf_nlp_extract gf_linker_worker gf_curation_worker gf_tag_suggester gf_tag_protocol gf_layout_worker

# Stage 4: Frontend and edge.
section "Stage 4 ▸ Frontend and edge"
services_to_start=(gf_frontend)
if [[ -d /etc/letsencrypt ]]; then
  services_to_start+=(edge)
else
  echo "Skipping edge service: /etc/letsencrypt is not available on this host"
fi

run_compose up -d --wait "${services_to_start[@]}"
if compose ps --format '{{.Name}}' gf_frontend >/dev/null 2>&1; then
  run_compose exec gf_frontend nginx -t
fi
if printf '%s\n' "${services_to_start[@]}" | grep -q '^edge$'; then
  run_compose ps edge
fi

echo
echo "Stack bring-up complete. Containers are running under the $(basename "$ROOT_DIR") project."
echo "Use '$(compose_command_string down)' to stop the stack when finished."
