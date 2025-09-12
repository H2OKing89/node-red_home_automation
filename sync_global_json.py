import subprocess
import sys
import os
import json
import time
import difflib
import tempfile
import requests
from datetime import datetime
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.prompt import Confirm
from rich.syntax import Syntax

# Initialize Rich console
console = Console()

# ==== CONFIGURATION ====
# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), 'config', '.env'))

remote_user = os.getenv("REMOTE_USER")
remote_host = os.getenv("REMOTE_HOST")
remote_path = os.getenv("REMOTE_PATH")
local_path = os.getenv("LOCAL_PATH")
# =======================

def validate_json_file(filepath):
    """Validate JSON file syntax and structure"""
    if not os.path.exists(filepath):
        console.print(f"[ERROR] File not found: {filepath}", style="red")
        return False
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            json.load(f)
        console.print(f"[SUCCESS] JSON validation passed: {os.path.basename(filepath)}", style="green")
        return True
    except json.JSONDecodeError as e:
        console.print(f"[ERROR] Invalid JSON in {os.path.basename(filepath)}: {e}", style="red")
        return False
    except Exception as e:
        console.print(f"[ERROR] Failed to read file {os.path.basename(filepath)}: {e}", style="red")
        return False

def test_ssh_connection():
    """Test SSH connectivity to remote host"""
    console.print("[INFO] Testing SSH connection...", style="blue")
    
    try:
        # Test basic SSH connection with shorter timeout
        test_cmd = ["ssh", "-o", "ConnectTimeout=5", "-o", "BatchMode=yes", 
                   f"{remote_user}@{remote_host}", "echo 'Connection successful'"]
        result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=8)
        
        if result.returncode == 0:
            console.print("[SUCCESS] SSH connection test passed", style="green")
            return True
        else:
            console.print(f"[WARNING] SSH connection failed (continuing anyway): {result.stderr.strip()}", style="yellow")
            return True  # Don't block the whole script for SSH issues
    except subprocess.TimeoutExpired:
        console.print("[WARNING] SSH connection timeout (continuing anyway)", style="yellow")
        return True  # Don't block the whole script for SSH issues
    except Exception as e:
        console.print(f"[WARNING] SSH test failed (continuing anyway): {e}", style="yellow")
        return True  # Don't block the whole script for SSH issues

def validate_ssh_key():
    """Validate SSH key configuration"""
    console.print("[INFO] Validating SSH key configuration...", style="blue")
    
    # Check if ssh-agent is running and has keys
    try:
        result = subprocess.run(["ssh-add", "-l"], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            console.print("[SUCCESS] SSH keys found in agent", style="green")
            return True
        elif result.returncode == 1:
            console.print("[WARNING] No SSH keys in agent, checking default key files...", style="yellow")
            
            # Check for common SSH key files
            ssh_dir = os.path.expanduser("~/.ssh")
            key_files = ["id_rsa", "id_ed25519", "id_ecdsa"]
            
            for key_file in key_files:
                key_path = os.path.join(ssh_dir, key_file)
                if os.path.exists(key_path):
                    console.print(f"[SUCCESS] Found SSH key: {key_file}", style="green")
                    return True
            
            console.print("[ERROR] No SSH keys found", style="red")
            return False
        else:
            console.print("[ERROR] SSH agent not running or accessible", style="red")
            return False
    except Exception as e:
        console.print(f"[ERROR] SSH key validation failed: {e}", style="red")
        return False

def get_remote_file():
    """Download remote file to temporary location for comparison"""
    try:
        temp_file = tempfile.NamedTemporaryFile(mode='w+', suffix='.json', delete=False)
        temp_path = temp_file.name
        temp_file.close()
        
        cmd = ["scp", f"{remote_user}@{remote_host}:{remote_path}", temp_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            return temp_path
        else:
            console.print(f"[WARNING] Could not fetch remote file: {result.stderr.strip()}", style="yellow")
            os.unlink(temp_path)
            return None
    except Exception as e:
        console.print(f"[ERROR] Failed to fetch remote file: {e}", style="red")
        return None

def get_file_status():
    """Get comprehensive file status comparison at startup"""
    console.print("[INFO] Checking file status...", style="blue")
    
    if not local_path or not os.path.exists(local_path):
        console.print("[ERROR] Local file not found", style="red")
        return None
    
    # Get local file info
    local_stat = os.stat(local_path)
    local_mtime = datetime.fromtimestamp(local_stat.st_mtime)
    local_size = local_stat.st_size
    
    # Try to get remote file info
    remote_temp_path = get_remote_file()
    if not remote_temp_path:
        return {
            'status': 'remote_unavailable',
            'local_mtime': local_mtime,
            'local_size': local_size,
            'remote_mtime': None,
            'remote_size': None,
            'files_identical': False,
            'recommendation': 'Cannot compare - remote file unavailable'
        }
    
    try:
        # Get remote file info
        remote_stat = os.stat(remote_temp_path)
        remote_mtime = datetime.fromtimestamp(remote_stat.st_mtime)
        remote_size = remote_stat.st_size
        
        # Compare file contents
        if not local_path:
            raise Exception("Local path not configured")
            
        with open(str(local_path), 'r', encoding='utf-8') as f:
            local_content = f.read()
        
        with open(remote_temp_path, 'r', encoding='utf-8') as f:
            remote_content = f.read()
        
        files_identical = local_content == remote_content
        
        # Determine recommendation
        if files_identical:
            recommendation = "Files are identical - no sync needed"
            status = 'identical'
        elif local_mtime > remote_mtime:
            recommendation = "Local file is newer - consider PUSH"
            status = 'local_newer'
        elif remote_mtime > local_mtime:
            recommendation = "Remote file is newer - consider PULL"
            status = 'remote_newer'
        else:
            recommendation = "Files modified at same time but differ - manual review needed"
            status = 'conflict'
        
        return {
            'status': status,
            'local_mtime': local_mtime,
            'local_size': local_size,
            'remote_mtime': remote_mtime,
            'remote_size': remote_size,
            'files_identical': files_identical,
            'recommendation': recommendation,
            'temp_remote_path': remote_temp_path
        }
        
    except Exception as e:
        console.print(f"[ERROR] File comparison failed: {e}", style="red")
        if remote_temp_path and os.path.exists(remote_temp_path):
            os.unlink(remote_temp_path)
        return None

def display_file_status(status_info):
    """Display file status in a nice format"""
    if not status_info:
        return
    
    from rich.table import Table
    
    table = Table(title="📊 File Status Comparison", border_style="blue")
    table.add_column("Location", style="cyan", width=12)
    table.add_column("Modified", style="yellow", width=20)
    table.add_column("Size", style="green", width=10)
    table.add_column("Status", width=15)
    
    # Local file row
    local_status = "📄 Present" if status_info['local_size'] else "❌ Missing"
    table.add_row(
        "Local",
        status_info['local_mtime'].strftime("%Y-%m-%d %H:%M:%S"),
        f"{status_info['local_size']} bytes",
        local_status
    )
    
    # Remote file row
    if status_info['remote_mtime']:
        remote_status = "📄 Present" if status_info['remote_size'] else "❌ Missing"
        table.add_row(
            "Remote", 
            status_info['remote_mtime'].strftime("%Y-%m-%d %H:%M:%S"),
            f"{status_info['remote_size']} bytes",
            remote_status
        )
    else:
        table.add_row("Remote", "Unknown", "Unknown", "❌ Unavailable")
    
    console.print(table)
    
    # Status panel
    status_styles = {
        'identical': 'green',
        'local_newer': 'yellow',
        'remote_newer': 'blue', 
        'conflict': 'red',
        'remote_unavailable': 'red'
    }
    
    status_icons = {
        'identical': '✅',
        'local_newer': '⬆️',
        'remote_newer': '⬇️',
        'conflict': '⚠️',
        'remote_unavailable': '❌'
    }
    
    icon = status_icons.get(status_info['status'], '❓')
    style = status_styles.get(status_info['status'], 'white')
    
    recommendation_panel = Panel(
        f"{icon} {status_info['recommendation']}",
        title="💡 Recommendation",
        border_style=style,
        padding=(0, 1)
    )
    
    console.print(recommendation_panel)
    console.print()

def show_detailed_diff(status_info):
    """Show detailed file differences"""
    if not status_info or not status_info.get('temp_remote_path'):
        console.print("[ERROR] Cannot show diff - remote file unavailable", style="red")
        return
    
    if status_info['files_identical']:
        console.print("[INFO] Files are identical - no differences to show", style="green")
        return
    
    try:
        # Read both files
        if not local_path:
            raise Exception("Local path not configured")
            
        with open(str(local_path), 'r', encoding='utf-8') as f:
            local_content = f.readlines()
        
        with open(status_info['temp_remote_path'], 'r', encoding='utf-8') as f:
            remote_content = f.readlines()
        
        # Generate diff
        diff = list(difflib.unified_diff(
            remote_content, local_content,
            fromfile=f"Remote: {remote_path} ({status_info['remote_mtime']})",
            tofile=f"Local: {local_path} ({status_info['local_mtime']})",
            lineterm=""
        ))
        
        if diff:
            console.print("[INFO] File differences:", style="blue")
            diff_text = "\n".join(diff[:50])  # Limit to first 50 lines
            if len(diff) > 50:
                diff_text += f"\n... ({len(diff) - 50} more lines truncated)"
            
            syntax = Syntax(diff_text, "diff", theme="monokai", line_numbers=False)
            console.print(syntax)
        
    except Exception as e:
        console.print(f"[ERROR] Failed to generate diff: {e}", style="red")

def retry_operation(func, max_retries=3, delay=1):
    """Retry an operation with exponential backoff"""
    for attempt in range(max_retries):
        try:
            result = func()
            return result
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            
            wait_time = delay * (2 ** attempt)
            console.print(f"[WARNING] Attempt {attempt + 1} failed: {e}", style="yellow")
            console.print(f"[INFO] Retrying in {wait_time} seconds...", style="blue")
            time.sleep(wait_time)
    
    return False

def send_webhook():
    """Send webhook notification to update Node-RED global context"""
    webhook_url = os.getenv('NODE-RED_GLOBAL_WEBHOOK')
    auth_secret = os.getenv('AUTH_SECRET')
    
    if not webhook_url or not auth_secret:
        console.print("[WARNING] Webhook URL or auth secret not found in .env file. Skipping webhook.", style="yellow")
        return False
    
    try:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_secret}'
        }
        
        payload = {
            'action': 'update_global_context',
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        console.print("[INFO] Sending webhook to update Node-RED global context...", style="blue")
        response = requests.post(webhook_url, json=payload, headers=headers, timeout=10)
        
        if response.status_code == 200:
            console.print("[SUCCESS] Webhook sent successfully.", style="green")
            return True
        else:
            console.print(f"[WARNING] Webhook returned status code {response.status_code}", style="yellow")
            return False
            
    except Exception as e:
        console.print(f"[ERROR] Failed to send webhook: {e}", style="red")
        return False

def run_pre_flight_checks():
    """Run all pre-flight validation checks"""
    console.print("[INFO] Running pre-flight checks...", style="blue")
    
    # Check environment variables
    if not all([remote_user, remote_host, remote_path, local_path]):
        console.print("[ERROR] Missing required environment variables", style="red")
        missing = []
        if not remote_user: missing.append("REMOTE_USER")
        if not remote_host: missing.append("REMOTE_HOST") 
        if not remote_path: missing.append("REMOTE_PATH")
        if not local_path: missing.append("LOCAL_PATH")
        console.print(f"Missing: {', '.join(missing)}", style="red")
        return False
    
    # Validate SSH configuration
    if not validate_ssh_key():
        return False
    
    # Test SSH connection
    if not test_ssh_connection():
        return False
        
    console.print("[SUCCESS] Pre-flight checks completed", style="green")
    return True

def pull():
    if not run_pre_flight_checks():
        return False
        
    def _pull_operation():
        cmd = [
            "scp",
            f"{remote_user}@{remote_host}:{remote_path}",
            local_path
        ]
        console.print("\n[INFO] Pulling remote file to local...", style="blue")
        console.print(" ".join(cmd), style="dim")
        result = subprocess.run(cmd, shell=False)
        if result.returncode != 0:
            raise Exception("SCP pull failed")
        return result.returncode == 0
    
    try:
        success = retry_operation(_pull_operation)
        if success:
            console.print("[SUCCESS] Pull complete.", style="green")
            # Validate the pulled JSON file
            if local_path and validate_json_file(local_path):
                console.print("[SUCCESS] Downloaded file validated successfully", style="green")
        return success
    except Exception as e:
        console.print(f"[ERROR] Pull failed after all retries: {e}", style="red")
        return False

def push():
    if not run_pre_flight_checks():
        return False
    
    # Validate local JSON file before pushing
    if not local_path or not validate_json_file(local_path):
        console.print("[ERROR] Local JSON validation failed. Aborting push.", style="red")
        return False
    
    # Get current status and ask for confirmation
    status_info = get_file_status()
    if status_info and not status_info['files_identical']:
        console.print("\n[INFO] Files are different. Showing detailed diff:", style="blue")
        show_detailed_diff(status_info)
        
        if not Confirm.ask("\n[bold yellow]Continue with push?[/bold yellow]"):
            console.print("[INFO] Push cancelled by user", style="yellow")
            temp_path = status_info.get('temp_remote_path')
            if temp_path and isinstance(temp_path, str) and os.path.exists(temp_path):
                os.unlink(temp_path)
            return False
    
    def _push_operation():
        cmd = [
            "scp",
            local_path,
            f"{remote_user}@{remote_host}:{remote_path}"
        ]
        console.print("\n[INFO] Pushing local file to remote...", style="blue")
        console.print(" ".join(cmd), style="dim")
        result = subprocess.run(cmd, shell=False)
        if result.returncode != 0:
            raise Exception("SCP push failed")
        return result.returncode == 0
    
    try:
        success = retry_operation(_push_operation)
        if success:
            console.print("[SUCCESS] Push complete.", style="green")
            # Send webhook after successful push
            send_webhook()
        return success
    except Exception as e:
        console.print(f"[ERROR] Push failed after all retries: {e}", style="red")
        return False
    finally:
        # Clean up temp file if exists
        if status_info:
            temp_path = status_info.get('temp_remote_path')
            if temp_path and isinstance(temp_path, str) and os.path.exists(temp_path):
                os.unlink(temp_path)

def print_header():
    """Print a styled header for the application"""
    title = Text("🔄 Node-RED Global JSON Sync Tool", style="bold magenta")
    
    header_text = Text()
    header_text.append("\n")
    header_text.append("✅ JSON validation & syntax checking\n", style="green")
    header_text.append("🔍 File comparison before sync\n", style="green")
    header_text.append("🔐 SSH key & connection validation\n", style="green")
    header_text.append("🔄 Automatic retry with backoff\n", style="green")
    header_text.append("🛡️ Pre-flight safety checks\n", style="green")
    header_text.append("📡 Webhook notifications\n", style="green")
    header_text.append("\n")
    header_text.append("Built with Rich for beautiful terminal output", style="dim italic")
    
    panel = Panel(
        header_text,
        title=title,
        title_align="center",
        border_style="blue",
        padding=(1, 2)
    )
    
    console.print(panel)
    console.print()  # Empty line for spacing

def main():
    print_header()
    
    # Show file status at startup
    if run_pre_flight_checks():
        console.print("=" * 60, style="dim")
        file_status = get_file_status()
        if file_status:
            display_file_status(file_status)
            
            # Clean up temp file after displaying status
            temp_path = file_status.get('temp_remote_path')
            if temp_path and isinstance(temp_path, str) and os.path.exists(temp_path):
                os.unlink(temp_path)
        console.print("=" * 60, style="dim")
    
    while True:  # Keep the menu running
        console.print("Choose an action:", style="bold cyan")
        console.print("1) Pull remote → local", style="cyan")
        console.print("2) Push local → remote", style="cyan")
        console.print("3) Show detailed file diff", style="cyan")
        console.print("4) Refresh file status", style="cyan")
        choice = input("Type 1, 2, 3, 4 (or q to quit): ").strip().lower()

        if choice == "1":
            pull()
        elif choice == "2":
            push()
        elif choice == "3":
            file_status = get_file_status()
            if file_status:
                show_detailed_diff(file_status)
                temp_path = file_status.get('temp_remote_path')
                if temp_path and isinstance(temp_path, str) and os.path.exists(temp_path):
                    os.unlink(temp_path)
        elif choice == "4":
            # Refresh file status
            console.print("=" * 60, style="dim")
            file_status = get_file_status()
            if file_status:
                display_file_status(file_status)
                temp_path = file_status.get('temp_remote_path')
                if temp_path and isinstance(temp_path, str) and os.path.exists(temp_path):
                    os.unlink(temp_path)
            console.print("=" * 60, style="dim")
        elif choice == "q":
            console.print("Quitting, nothing done. 👍", style="green")
            sys.exit(0)
        else:
            console.print("Not a valid choice. Try again.", style="red")
        
        # Add a separator between operations
        console.print()  # Empty line for better readability

if __name__ == "__main__":
    main()
