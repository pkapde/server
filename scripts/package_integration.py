"""Build a source-only handoff archive; never include secrets or runtime data."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]


def package():
    destination = ROOT / "dist" / "mcp-fastapi-integration.zip"
    destination.parent.mkdir(exist_ok=True)
    sources = [
        ROOT / name
        for name in (
            "INTEGRATION.md",
            "MCP_RUNBOOK.md",
            "README.md",
            "requirements-mcp.txt",
            "pyproject.toml",
            "main_mcp_demo.py",
            "main_mcp_llm.py",
            "main_mcp_react.py",
            "FRONTEND.md",
            ".env.llm.example",
        )
    ]
    for directory, suffix in (("semantic_mcp", ".py"), ("scripts", ".py"), ("tests", ".py")):
        sources.extend((ROOT / directory).glob("*" + suffix))
    sources.extend((ROOT / "examples").glob("*.yaml"))
    sources.extend((ROOT / "examples").glob("*.json"))
    for source in (ROOT / "frontend").rglob("*"):
        if source.is_file() and not any(
            part in {"node_modules", "dist", ".vite"} for part in source.relative_to(ROOT / "frontend").parts
        ):
            sources.append(source)
    with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
        for source in sorted(sources):
            archive.write(source, source.relative_to(ROOT).as_posix())
    return destination


if __name__ == "__main__":
    print(package())
