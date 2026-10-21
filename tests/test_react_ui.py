from fastapi import FastAPI
from fastapi.testclient import TestClient

from semantic_mcp.integration import install_mcp
from semantic_mcp.react_ui import install_react_ui


def test_react_static_host_preserves_mcp_auth_and_hides_credentials(service, tmp_path, monkeypatch):
    monkeypatch.setattr("semantic_mcp.app.QueryService", lambda settings: service)
    (tmp_path / "index.html").write_text('<html><div id="root">React workspace</div></html>')
    host = FastAPI()
    install_mcp(host, service.settings)
    install_react_ui(
        host,
        questions=["How many total interactions by channel?"],
        settings=service.settings,
        model_name=service.model.name,
        directory=tmp_path,
    )
    with TestClient(host) as client:
        assert client.get("/").status_code == 200
        config = client.get("/ui-config").json()
        assert config["prefix"] == "/analytics"
        assert "api_tokens" not in config and "llm_api_key" not in config
        assert client.post("/analytics/mcp", json={}).status_code == 401
        assert client.get("/analytics/health").json()["execution_mode"] == "demo"


def test_unbuilt_frontend_has_actionable_message(service, tmp_path):
    host = FastAPI()
    install_react_ui(host, questions=[], settings=service.settings, model_name="demo", directory=tmp_path)
    with TestClient(host) as client:
        assert client.get("/").status_code == 503
        assert "pnpm build" in client.get("/").text
