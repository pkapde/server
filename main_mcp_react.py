"""React frontend + isolated MCP backend; no tuning-fork imports.

python -m uvicorn main_mcp_react:create_app --factory --host 127.0.0.1 --port 8000
"""

import json
from pathlib import Path

from fastapi import FastAPI

from semantic_mcp.config import Settings
from semantic_mcp.integration import IntegrationSettings, install_mcp
from semantic_mcp.react_ui import install_react_ui


def create_app(settings: Settings | None = None):
    settings = settings or IntegrationSettings()
    if settings.execution_mode == "demo" and not settings.demo_database_path.exists():
        reference = Path(__file__).resolve().parent / "examples" / "cx.ossie.yaml"
        if settings.model_path.resolve() != reference:
            raise RuntimeError("Prepare the custom model's demo database before starting")
        from scripts.seed_demo import seed

        seed(settings.demo_database_path)
    app = FastAPI(title="CX Semantic Workspace", version="0.2.0")
    child = install_mcp(app, settings)
    install_react_ui(
        app,
        questions=list(json.loads(Path("examples/questions.json").read_text(encoding="utf-8"))),
        settings=settings,
        model_name=child.state.service.model.name,
    )
    return app
