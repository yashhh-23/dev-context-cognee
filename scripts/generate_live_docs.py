import subprocess
import os
from collections import defaultdict

def run_git_log():
    try:
        result = subprocess.run(
            ['git', 'log', '--format=%h||%an||%ad||%s', '--date=short'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip().split('\n')
    except subprocess.CalledProcessError as e:
        print(f"Error running git log: {e}")
        return []

def generate_docs():
    lines = run_git_log()
    if not lines or (len(lines) == 1 and lines[0] == ''):
        print("No commits found.")
        return

    commits_by_author = defaultdict(list)
    
    for line in lines:
        if not line:
            continue
        parts = line.split('||', 3)
        if len(parts) == 4:
            commit_hash, author, date, msg = parts
            commits_by_author[author].append({
                'hash': commit_hash,
                'date': date,
                'msg': msg
            })
            
    # Markdown generation
    md_content = "# Live Contributors Document\n\n"
    md_content += "> This document is automatically generated to track contributions to the project based on the Git commit history.\n\n"
    
    # Sort authors by number of commits descending, then alphabetically
    sorted_authors = sorted(commits_by_author.keys(), key=lambda x: (-len(commits_by_author[x]), x))
    
    for author in sorted_authors:
        commits = commits_by_author[author]
        md_content += f"## {author} ({len(commits)} commit{'s' if len(commits) != 1 else ''})\n\n"
        md_content += "| Commit | Date | Message |\n"
        md_content += "|---|---|---|\n"
        for commit in commits:
            md_content += f"| `{commit['hash']}` | {commit['date']} | {commit['msg']} |\n"
        md_content += "\n"
        
    # Write to file
    doccs_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'doccs')
    os.makedirs(doccs_dir, exist_ok=True)
    out_path = os.path.join(doccs_dir, 'LIVE_CONTRIBUTORS.md')
    
    try:
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"Generated live document at {out_path}")
    except Exception as e:
        print(f"Error writing to file: {e}")

if __name__ == '__main__':
    generate_docs()
