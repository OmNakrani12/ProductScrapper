import re
import logging
import json
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import httpx

from app.scraper.email_extractor import is_valid_email_candidate

logger = logging.getLogger(__name__)

# Regex Patterns
GITHUB_REPO_REGEX = re.compile(
    r'https?://(?:www\.)?github\.com/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_.-]+)', re.IGNORECASE
)
GITHUB_USER_REGEX = re.compile(
    r'https?://(?:www\.)?github\.com/([a-zA-Z0-9_-]+)/?', re.IGNORECASE
)
COMMIT_EMAIL_REGEX = re.compile(
    r'<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>', re.IGNORECASE
)
GIT_LOG_EMAIL_REGEX = re.compile(
    r'(?:author|committer|email|by)\s*[:=]?\s*.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', re.IGNORECASE
)
SECURITY_TXT_EMAIL_REGEX = re.compile(
    r'Contact:\s*(?:mailto:)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', re.IGNORECASE
)

# Common non-personal service emails to exclude from personal deployer list
GENERIC_PREFIXES = ('info@', 'support@', 'contact@', 'sales@', 'help@', 'admin@', 'office@', 'service@', 'hello@', 'jobs@', 'careers@')

async def extract_deployer_info(base_url: str, html_text: str, client: httpx.AsyncClient) -> dict:
    """
    Scrapes deployer/developer personal emails and profiles using multiple non-API techniques:
    1. GitHub repo/profile commit & API metadata analysis
    2. Exposed /.git directory logs & config inspection
    3. /.well-known/security.txt & security.txt contact fields
    4. Author/Developer meta tags & Schema.org Person JSON-LD
    """
    deployer_emails = set()
    social_profiles = set()
    sources_found = []

    if not html_text:
        html_text = ""

    soup = BeautifulSoup(html_text, "lxml") if html_text else None

    # -------------------------------------------------------------
    # 1. Author Meta Tags & Schema.org Person JSON-LD Parsing
    # -------------------------------------------------------------
    if soup:
        # Check author/developer meta tags
        for meta_name in ["author", "developer", "creator", "owner", "maintainer"]:
            meta_tag = soup.find("meta", attrs={"name": meta_name}) or soup.find("meta", property=f"article:{meta_name}")
            if meta_tag and meta_tag.get("content"):
                content = meta_tag.get("content").strip()
                if "@" in content:
                    for email_match in re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', content):
                        if is_valid_email_candidate(email_match):
                            deployer_emails.add(email_match.lower())
                            sources_found.append("meta_tag")

        # JSON-LD Person schema search
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                if not script.string:
                    continue
                data = json.loads(script.string)
                _extract_person_json_ld(data, deployer_emails, social_profiles)
            except Exception:
                continue

        # Extract social profile links (GitHub, LinkedIn, Twitter/X)
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if "github.com/" in href or "linkedin.com/in/" in href or "twitter.com/" in href or "x.com/" in href:
                social_profiles.add(href)

    # -------------------------------------------------------------
    # 2. GitHub Commits & User Metadata Extraction
    # -------------------------------------------------------------
    github_repos = []
    github_users = []

    for profile in social_profiles:
        repo_match = GITHUB_REPO_REGEX.search(profile)
        if repo_match:
            user, repo = repo_match.group(1), repo_match.group(2)
            # Avoid generic github orgs like 'github' or 'facebook' or frameworks
            if user.lower() not in ('github', 'facebook', 'google', 'vercel', 'tailwindlabs', 'vercel'):
                github_repos.append((user, repo))
        else:
            user_match = GITHUB_USER_REGEX.search(profile)
            if user_match:
                user = user_match.group(1)
                if user.lower() not in ('github', 'about', 'features', 'pricing', 'security'):
                    github_users.append(user)

    # Probe GitHub repos for commit author emails
    for user, repo in github_repos[:2]:  # Limit probes to top 2 repos
        try:
            # Try fetching recent commit patch or atom feed (doesn't require GitHub token)
            patch_url = f"https://github.com/{user}/{repo}/commits/main.patch"
            resp = await client.get(patch_url, timeout=5.0, follow_redirects=True)
            if resp.status_code == 200:
                for email in COMMIT_EMAIL_REGEX.findall(resp.text[:10000]):
                    if is_valid_email_candidate(email) and not email.endswith("noreply.github.com"):
                        deployer_emails.add(email.lower())
                        sources_found.append("github_commit_patch")

            # Fallback to public GitHub API
            if not deployer_emails:
                api_url = f"https://api.github.com/repos/{user}/{repo}/commits"
                api_resp = await client.get(api_url, headers={"Accept": "application/vnd.github.v3+json"}, timeout=5.0)
                if api_resp.status_code == 200:
                    commits_data = api_resp.json()
                    if isinstance(commits_data, list):
                        for c in commits_data[:3]:
                            commit_author = c.get("commit", {}).get("author", {})
                            c_email = commit_author.get("email")
                            if c_email and is_valid_email_candidate(c_email) and not c_email.endswith("noreply.github.com"):
                                deployer_emails.add(c_email.lower())
                                sources_found.append("github_api_commit")
        except Exception as e:
            logger.debug(f"GitHub probe error for {user}/{repo}: {e}")

    # Probe GitHub Users for public profile emails
    for user in github_users[:2]:
        try:
            user_api = f"https://api.github.com/users/{user}"
            u_resp = await client.get(user_api, headers={"Accept": "application/vnd.github.v3+json"}, timeout=5.0)
            if u_resp.status_code == 200:
                u_data = u_resp.json()
                u_email = u_data.get("email")
                if u_email and is_valid_email_candidate(u_email):
                    deployer_emails.add(u_email.lower())
                    sources_found.append("github_user_profile")
        except Exception as e:
            logger.debug(f"GitHub user probe error for {user}: {e}")

    # -------------------------------------------------------------
    # 3. Probe Exposed /.git Directory Metadata
    # -------------------------------------------------------------
    parsed_base = urlparse(base_url)
    origin_url = f"{parsed_base.scheme}://{parsed_base.netloc}"

    git_endpoints = [
        "/.git/logs/HEAD",
        "/.git/COMMIT_EDITMSG",
        "/.git/config"
    ]

    for endpoint in git_endpoints:
        git_target = urljoin(origin_url, endpoint)
        try:
            g_resp = await client.get(git_target, timeout=4.0, follow_redirects=False)
            if g_resp.status_code == 200 and ("ref:" in g_resp.text or "commit" in g_resp.text or "repositoryformatversion" in g_resp.text or "Author" in g_resp.text):
                found = GIT_LOG_EMAIL_REGEX.findall(g_resp.text)
                for email in found:
                    if is_valid_email_candidate(email) and not email.endswith("noreply.github.com"):
                        deployer_emails.add(email.lower())
                        sources_found.append("exposed_git_log")
        except Exception:
            pass

    # -------------------------------------------------------------
    # 4. Probe /.well-known/security.txt
    # -------------------------------------------------------------
    security_endpoints = [
        "/.well-known/security.txt",
        "/security.txt"
    ]

    for sec_ep in security_endpoints:
        sec_target = urljoin(origin_url, sec_ep)
        try:
            sec_resp = await client.get(sec_target, timeout=4.0, follow_redirects=True)
            if sec_resp.status_code == 200 and "Contact:" in sec_resp.text:
                for sec_email in SECURITY_TXT_EMAIL_REGEX.findall(sec_resp.text):
                    if is_valid_email_candidate(sec_email):
                        deployer_emails.add(sec_email.lower())
                        sources_found.append("security_txt")
        except Exception:
            pass

    # Filter out generic emails if personal emails were found
    personal_emails = [e for e in deployer_emails if not any(e.startswith(p) for p in GENERIC_PREFIXES)]
    final_emails = personal_emails if personal_emails else list(deployer_emails)

    return {
        "deployer_emails": sorted(final_emails),
        "social_profiles": sorted(list(social_profiles)),
        "sources": sorted(list(set(sources_found)))
    }

def _extract_person_json_ld(data, emails_set: set, profiles_set: set):
    """Recursively search for Person objects in JSON-LD."""
    if isinstance(data, dict):
        if data.get("@type") in ("Person", "author", "creator"):
            email = data.get("email")
            if isinstance(email, str) and is_valid_email_candidate(email):
                emails_set.add(email.lower())
            same_as = data.get("sameAs")
            if isinstance(same_as, str):
                profiles_set.add(same_as)
            elif isinstance(same_as, list):
                profiles_set.update([s for s in same_as if isinstance(s, str)])
        for v in data.values():
            _extract_person_json_ld(v, emails_set, profiles_set)
    elif isinstance(data, list):
        for item in data:
            _extract_person_json_ld(item, emails_set, profiles_set)
