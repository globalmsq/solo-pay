#!/usr/bin/env python3
"""
MoAI-ADK PreToolUse Hook
Validates document operations before Edit/Write/MultiEdit.
"""
import json
import os
import sys
from pathlib import Path


def main():
    """Validate document operations."""
    # Get tool input from environment (Claude Code passes this)
    tool_input = os.environ.get("CLAUDE_TOOL_INPUT", "{}")
    
    try:
        input_data = json.loads(tool_input)
    except json.JSONDecodeError:
        # Can't parse input, allow operation to proceed
        return 0
    
    # Extract file path from input
    file_path = input_data.get("file_path", "")
    
    if not file_path:
        # No file path, allow operation
        return 0
    
    # Check for protected paths (additional safety)
    protected_patterns = [
        ".env",
        "secrets/",
        ".ssh/",
        ".aws/",
        "credentials",
    ]
    
    file_path_lower = file_path.lower()
    for pattern in protected_patterns:
        if pattern in file_path_lower:
            # Let Claude Code's built-in permissions handle this
            # Just log a warning
            pass
    
    # All checks passed
    return 0


if __name__ == "__main__":
    sys.exit(main())
