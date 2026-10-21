"""Serve the optional built React client on the host, outside protected MCP routes."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles


def install_react_ui(
    app: FastAPI,
    *,
    questions: list[str],
    settings,
    model_name: str,
    prefix="/analytics",
    directory: Path | None = None,
):
    directory = directory or Path(__file__).resolve().parents[1] / "frontend" / "dist"

    @app.get("/ui-config", include_in_schema=False)
    async def ui_config():
        return {
            "prefix": prefix,
            "questions": questions,
            "resolver_mode": settings.resolver_mode,
            "execution_mode": settings.execution_mode,
            "model": model_name,
        }

    if (directory / "index.html").is_file():
        app.mount("/", StaticFiles(directory=directory, html=True), name="react-workspace")
    else:

        @app.get("/", response_class=HTMLResponse, include_in_schema=False)
        async def build_required():
            return HTMLResponse(
                "<h1>Build the React workspace</h1><p>In frontend/, run <code>pnpm install</code> "
                "and <code>pnpm build</code>, then restart the server. "
                "For development run <code>pnpm dev</code> and open http://127.0.0.1:5173/.</p>",
                status_code=503,
            )
