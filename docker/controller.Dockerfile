# Ryu controller + REST API.
#
# Python 3.11 is pinned deliberately: Ryu 4.34 depends on an old eventlet that
# does not import on 3.12+, where ssl.wrap_socket was removed. This is the
# newest interpreter the controller actually runs on.
FROM python:3.11-slim-bookworm

# Ryu builds nothing, but pip resolves faster with these present and they are
# dropped from the final layer.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY SDN_files/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY SDN_files/ ./SDN_files/

# OpenFlow listener and REST/SSE endpoint.
EXPOSE 6633 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8080/lastmile/health || exit 1

CMD ["ryu-manager", \
     "--ofp-tcp-listen-port", "6633", \
     "--wsapi-host", "0.0.0.0", \
     "--wsapi-port", "8080", \
     "SDN_files/qos_controller.py", \
     "SDN_files/rest_api.py"]
