#!/usr/bin/env python3
"""
MoAI-ADK SessionEnd Hook
Performs cleanup tasks at the end of each session.
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone


def main():
    """Perform session cleanup."""
    project_root = Path.cwd()
    logs_dir = project_root / ".moai" / "logs"
    
    # Create logs directory if it doesn't exist
    logs_dir.mkdir(parents=True, exist_ok=True)
    
    # Log session end (simple timestamp)
    session_log = logs_dir / "session_history.json"
    
    try:
        if session_log.exists():
            with open(session_log, "r", encoding="utf-8") as f:
                history = json.load(f)
        else:
            history = {"sessions": []}
        
        # Add session end entry
        history["sessions"].append({
            "type": "session_end",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Keep only last 100 entries
        history["sessions"] = history["sessions"][-100:]
        
        with open(session_log, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
        
        return 0
        
    except Exception as e:
        # Non-critical failure, don't block session end
        print(f"Warning: Cleanup failed: {e}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    sys.exit(main())
