#!/usr/bin/env python3
"""
MoAI-ADK SessionStart Hook
Shows project information at the start of each session.
"""
import json
import sys
from pathlib import Path


def main():
    """Display project info at session start."""
    project_root = Path.cwd()
    config_path = project_root / ".moai" / "config" / "config.json"
    
    if not config_path.exists():
        # No config, silently exit (project not initialized)
        return 0
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        
        project = config.get("project", {})
        language = config.get("language", {})
        
        # Project info (silent - just validate config exists)
        project_name = project.get("name", "Unknown")
        mode = project.get("mode", "personal")
        lang = language.get("conversation_language", "en")
        
        # Hook succeeded - config is valid
        return 0
        
    except json.JSONDecodeError:
        print("Warning: Invalid config.json format", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Warning: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
