#!/usr/bin/env python3
"""
Copy directory reviews from the old Sabai directory on live
(www.secretcarshalton.com) onto the matching sc-directory listings on
staging, as comments with a star rating (sc_rating), with each owner reply
underneath as a child comment.

Sabai keeps reviews in its own tables, which the WP REST API doesn't expose,
so they're read from each live listing's public page. Listings are matched
to staging by exact title (normalised), and people by username. A review or
reply author who isn't on staging yet is created there with the same
username, email and display name and a random password: their live
password can't be read through the API, so they use "forgot password"
once after go-live.

Re-runnable: a review or reply already on staging (same listing, author
and date) is skipped, so run it again just before go-live to pick up
anything new. Dry run by default; pass --apply to write.

Needs sc-membership 0.23.2+ on staging (moderators can set `rating` on
core's comments endpoint). Credentials come from WP_USERNAME and
WP_APP_PASSWORD (an administrator Application Password that works on both
sites).

Not copied: Sabai's "N of M found this helpful" votes, which are tied to
Sabai's own voter records.
"""
import argparse
import datetime
import html
import json
import os
import re
import secrets
import subprocess
import sys

LIVE = "https://www.secretcarshalton.com"
STAGING = "https://www.staging19.secretcarshalton.com"
AUTH = os.environ["WP_USERNAME"] + ":" + os.environ["WP_APP_PASSWORD"]


def curl(*args, auth=True):
    cmd = ["curl", "-sS", "-L"] + (["-u", AUTH] if auth else []) + list(args)
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def api(url, method="GET", body=None):
    args = [url]
    if method != "GET":
        args = ["-X", method, "-H", "Content-Type: application/json", "-d", json.dumps(body), url]
    out = curl(*args)
    data = json.loads(out)
    if isinstance(data, dict) and data.get("code") and method != "GET":
        raise SystemExit(f"{method} {url} failed: {data}")
    return data


def norm(s):
    return re.sub(r"[^a-z0-9]", "", html.unescape(s).lower())


def sabai_date(s):
    return datetime.datetime.strptime(s, "%B %d, %Y %I:%M %p").strftime("%Y-%m-%dT%H:%M:00")


def live_listing_slugs():
    slugs = set()
    for page in range(1, 20):
        found = set(re.findall(r"directory/listing/([a-z0-9-]+)", curl(f"{LIVE}/directory?p={page}", auth=False)))
        if not found - slugs and page > 1:
            break
        slugs |= found
    return sorted(slugs)


def parse_reviews(page):
    """Each review on a live listing page, with its owner replies."""
    reviews = []
    blocks = re.split(
        r'(?=<div id="sabai-entity-content-\d+" class="sabai-entity sabai-entity-type-content sabai-entity-bundle-name-directory-listing-review)',
        page,
    )[1:]
    for b in blocks:
        rid = re.search(r"sabai-entity-content-(\d+)", b).group(1)
        title = re.search(r'sabai-directory-review-title"[^>]*>(.*?)</div>', b, re.S)
        reviews.append(
            {
                "id": int(rid),
                "author": html.unescape(re.search(r'sabai/user/profile/([^/"]+)/', b).group(1).replace("%20", " ")),
                "date": sabai_date(re.search(r'reviews/%s" title="([^"]+)"' % rid, b).group(1)),
                "title": html.unescape(re.sub(r"<[^>]+>", "", title.group(1))).strip() if title else "",
                "rating": int(re.search(r"sabai-rating-(\d+)", b).group(1)) // 10,
                "body": re.search(r'itemprop="reviewBody">(.*?)</div>', b, re.S).group(1).strip(),
                "replies": [
                    {
                        "author": html.unescape(m.group(1).replace("%20", " ")),
                        "date": sabai_date(m.group(2)),
                        "body": m.group(3).strip(),
                    }
                    for m in re.finditer(
                        r'<li id="sabai-comment-\d+".*?profile/([^/"]+)/.*?sabai-comment-date"><span title="([^"]+)".*?<div class="sabai-comment-main">(.*?)</div>',
                        b,
                        re.S,
                    )
                ],
            }
        )
    return reviews


def find_user(site, username):
    for u in api(f"{site}/wp-json/wp/v2/users?search={username.replace(' ', '%20')}&context=edit&per_page=100&_fields=id,username,name,email,registered_date"):
        if u["username"].lower() == username.lower():
            return u
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write to staging (default: dry run)")
    apply = ap.parse_args().apply

    staging_listings = {}
    for page in range(1, 10):
        batch = api(f"{STAGING}/wp-json/wp/v2/sc-listings?per_page=100&page={page}&_fields=id,title")
        if not isinstance(batch, list) or not batch:
            break
        for x in batch:
            staging_listings[norm(x["title"]["rendered"])] = x["id"]

    users = {}

    def staging_user(username):
        if username in users:
            return users[username]
        u = find_user(STAGING, username)
        if not u:
            live_u = find_user(LIVE, username)
            if not live_u:
                raise SystemExit(f"{username}: not found on live either")
            print(f"  + member {username} (live {live_u['id']}, joined {live_u['registered_date'][:10]})")
            u = {"id": None}
            if apply:
                u = api(
                    f"{STAGING}/wp-json/wp/v2/users",
                    "POST",
                    {
                        "username": live_u["username"],
                        "email": live_u["email"],
                        "name": live_u["name"],
                        "password": secrets.token_urlsafe(24),
                        "roles": ["subscriber"],
                    },
                )
        users[username] = u["id"]
        return u["id"]

    def existing(listing_id, author_id, date, parent):
        if author_id is None:
            return None
        for c in api(f"{STAGING}/wp-json/wp/v2/comments?post={listing_id}&author={author_id}&parent={parent}&per_page=100&context=edit&_fields=id,date"):
            if c["date"] == date:
                return c["id"]
        return None

    for slug in live_listing_slugs():
        page = curl(f"{LIVE}/directory/listing/{slug}", auth=False)
        reviews = parse_reviews(page)
        if not reviews:
            continue
        title = re.search(r"<title>(.*?)</title>", page).group(1).replace(" | Secret Carshalton", "")
        listing_id = staging_listings.get(norm(title))
        if not listing_id:
            print(f"! {slug}: {len(reviews)} review(s) but no staging listing titled {html.unescape(title)!r}")
            continue
        print(f"{slug} -> listing {listing_id}")
        for r in reviews:
            author_id = staging_user(r["author"])
            review_id = existing(listing_id, author_id, r["date"], 0)
            if review_id:
                print(f"  = review by {r['author']} {r['date']} already on staging ({review_id})")
            else:
                print(f"  + review by {r['author']} {r['date']} {r['rating']}★ {r['title']!r}")
                if apply:
                    content = (f"<p><strong>{html.escape(r['title'])}</strong></p>\n" if r["title"] else "") + r["body"]
                    review_id = api(
                        f"{STAGING}/wp-json/wp/v2/comments",
                        "POST",
                        {"post": listing_id, "author": author_id, "date": r["date"], "content": content, "status": "approved", "rating": r["rating"]},
                    )["id"]
            for rep in r["replies"]:
                rep_author = staging_user(rep["author"])
                if review_id and existing(listing_id, rep_author, rep["date"], review_id):
                    print(f"    = reply by {rep['author']} {rep['date']} already on staging")
                    continue
                print(f"    + reply by {rep['author']} {rep['date']}")
                if apply:
                    api(
                        f"{STAGING}/wp-json/wp/v2/comments",
                        "POST",
                        {"post": listing_id, "parent": review_id, "author": rep_author, "date": rep["date"], "content": f"<p>{rep['body']}</p>", "status": "approved"},
                    )
    if not apply:
        print("\nDry run. Re-run with --apply to write.")


if __name__ == "__main__":
    sys.exit(main())
