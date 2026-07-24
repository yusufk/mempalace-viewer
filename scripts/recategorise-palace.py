#!/usr/bin/env python3
"""
MemPalace Re-categoriser
Reads Obsidian frontmatter tags from source files and updates drawer wing/room.
Also purges junk drawers (.obsidian plugin files).

Usage:
  python scripts/recategorise-palace.py --dry-run   # preview changes
  python scripts/recategorise-palace.py              # apply changes
"""
import os
import re
import sys
import chromadb
from collections import Counter

PALACE_PATH = os.path.expanduser("~/.mempalace/palace")
DRY_RUN = "--dry-run" in sys.argv

# ── Tag → Wing mapping ──
# First matching tag wins. Order matters (most specific first).
TAG_TO_WING = {
    # Technical
    "architecture": "technical",
    "technical-architecture": "technical",
    "commerce-cloud": "technical",
    "sap-commerce-cloud": "technical",
    "sap": "technical",
    "solr": "technical",
    "aws": "technical",
    "aws-infrastructure": "technical",
    "infrastructure": "technical",
    "kubernetes": "technical",
    "eks": "technical",
    "fargate": "technical",
    "platform": "technical",
    "cloudflare": "technical",
    "caching": "technical",
    "ci-cd": "technical",
    "authentication": "technical",
    "react-native": "technical",
    "sentry": "technical",
    "hybris": "technical",
    "spartacus": "technical",
    "magento": "technical",
    "valkey": "technical",
    "api": "technical",
    "technical": "technical",
    "integration-architecture": "technical",
    "technology-integration": "technical",

    # Strategy
    "strategy": "strategy",
    "roadmap": "strategy",
    "product-vision": "strategy",
    "product-strategy": "strategy",
    "digital-channels": "strategy",
    "digital-transformation": "strategy",
    "digital-vision": "strategy",
    "digital-strategy": "strategy",
    "store-of-future": "strategy",
    "store-of-the-future": "strategy",
    "sotf": "strategy",
    "ecosystem": "strategy",
    "ecosystem-strategy": "strategy",
    "10-year-vision": "strategy",
    "app-strategy": "strategy",
    "app-product-strategy": "strategy",
    "mobile-strategy": "strategy",
    "category-strategy": "strategy",
    "homepage-strategy": "strategy",
    "planning": "strategy",

    # Analytics
    "analytics": "analytics",
    "performance": "analytics",
    "analysis": "analytics",
    "data-analysis": "analytics",
    "user-experience": "analytics",
    "user-behavior": "analytics",
    "navigation-design": "analytics",
    "web-metrics": "analytics",
    "app-metrics": "analytics",
    "app-usage": "analytics",
    "cost-analysis": "analytics",
    "competitive-analysis": "analytics",
    "measurement": "analytics",

    # Operations
    "fulfilment": "operations",
    "fulfillment": "operations",
    "fulfillment-strategy": "operations",
    "payments": "operations",
    "paygate": "operations",
    "stock-management": "operations",
    "delivery-strategy": "operations",
    "deliverd": "operations",
    "click-collect": "operations",
    "operations": "operations",
    "incident": "operations",
    "incident-management": "operations",
    "incident-report": "operations",
    "outage": "operations",
    "monitoring": "operations",
    "oaa": "operations",
    "oaa-system": "operations",

    # Governance
    "meeting-notes": "governance",
    "qbr": "governance",
    "steerco-response": "governance",
    "steerco-preparation": "governance",
    "risk-management": "governance",
    "risk-register": "governance",
    "risk-assessment": "governance",
    "governance": "governance",
    "leadership-summit": "governance",
    "leadership-update": "governance",
    "management-meeting": "governance",
    "weekly-summary": "governance",
    "daily-note": "governance",
    "presentation": "governance",

    # People
    "hiring": "people",
    "job-description": "people",
    "job-descriptions": "people",
    "team-structure": "people",
    "squad-mapping": "people",
    "squad-structure": "people",
    "organizational-structure": "people",
    "mckinsey": "people",
    "partnerships": "people",
    "vendors": "people",
    "tribe-1": "people",

    # Health
    "health": "health",
    "pharmacy": "health",
    "dispensary": "health",
    "better-rewards": "health",
    "healthcare": "health",
    "health-platform": "health",
    "health-hub-concept": "health",
    "chronic-disease": "health",

    # CRM / Customer
    "crm": "customer",
    "cdc": "customer",
    "cdc-integration": "customer",
    "cdc-registration": "customer",
    "customer-experience": "customer",
    "customer-engagement": "customer",
    "customer-data": "customer",
    "loyalty": "customer",
    "personalization": "customer",
    "registration": "customer",
    "identity-management": "customer",

    # Commerce / eCommerce
    "ecommerce": "commerce",
    "ecommerce-vision": "commerce",
    "ecommerce-operations": "commerce",
    "online-shopping": "commerce",
    "discounts": "commerce",
    "pricing": "commerce",
    "marketing": "commerce",
    "braze": "commerce",
    "amplience": "commerce",
    "black-friday": "commerce",

    # Security
    "security": "security",
    "security-compliance": "security",
    "pci-compliance": "security",
    "pci-dss": "security",
    "waf": "security",
    "fraud-detection": "security",
    "fraud-investigation": "security",
}

# ── Tag → Room mapping (more specific) ──
TAG_TO_ROOM = {
    # Technical rooms
    "architecture": "architecture",
    "technical-architecture": "architecture",
    "commerce-cloud": "commerce-cloud",
    "sap-commerce-cloud": "commerce-cloud",
    "sap": "commerce-cloud",
    "hybris": "commerce-cloud",
    "spartacus": "commerce-cloud",
    "solr": "search",
    "aws": "aws",
    "aws-infrastructure": "aws",
    "kubernetes": "aws",
    "eks": "aws",
    "fargate": "aws",
    "infrastructure": "infrastructure",
    "platform": "infrastructure",
    "cloudflare": "infrastructure",
    "ci-cd": "devops",
    "authentication": "auth",
    "react-native": "mobile-app",
    "api": "api",
    "integration-architecture": "integrations",
    "technology-integration": "integrations",

    # Strategy rooms
    "roadmap": "roadmap",
    "product-vision": "product-vision",
    "product-strategy": "product-vision",
    "store-of-future": "store-of-future",
    "store-of-the-future": "store-of-future",
    "sotf": "store-of-future",
    "digital-channels": "digital-channels",
    "app-strategy": "app-strategy",
    "app-product-strategy": "app-strategy",
    "category-strategy": "categories",

    # Analytics rooms
    "analytics": "analytics",
    "performance": "performance",
    "user-experience": "ux",
    "user-behavior": "ux",
    "navigation-design": "ux",
    "cost-analysis": "costs",
    "web-metrics": "web-metrics",
    "app-metrics": "app-metrics",

    # Governance rooms
    "meeting-notes": "meetings",
    "qbr": "qbr",
    "steerco-response": "steerco",
    "steerco-preparation": "steerco",
    "risk-management": "risk",
    "risk-register": "risk",
    "leadership-summit": "leadership",
    "governance": "governance",
    "daily-note": "daily",
    "weekly-summary": "weekly",

    # Operations rooms
    "fulfilment": "fulfilment",
    "fulfillment": "fulfilment",
    "payments": "payments",
    "paygate": "payments",
    "stock-management": "stock",
    "oaa": "stock",
    "oaa-system": "stock",
    "click-collect": "fulfilment",
    "incident": "incidents",
    "incident-management": "incidents",

    # People rooms
    "hiring": "hiring",
    "job-description": "hiring",
    "team-structure": "squads",
    "squad-mapping": "squads",
    "mckinsey": "consultants",
    "vendors": "vendors",
    "tribe-1": "tribe-1",

    # Health rooms
    "pharmacy": "pharmacy",
    "dispensary": "pharmacy",
    "better-rewards": "better-rewards",
    "health-platform": "health-platform",

    # Commerce rooms
    "black-friday": "black-friday",
    "pricing": "pricing",
    "discounts": "pricing",
    "marketing": "marketing",
    "braze": "marketing",
}


def extract_tags_from_file(filepath):
    """Read Obsidian frontmatter tags from a markdown file."""
    try:
        with open(filepath, "r", errors="ignore") as f:
            content = f.read(2000)  # frontmatter is at the top
    except (FileNotFoundError, PermissionError):
        return []

    # Match YAML frontmatter
    m = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not m:
        return []

    tags = []
    in_tags = False
    for line in m.group(1).split("\n"):
        if line.strip().startswith("tags:"):
            in_tags = True
            continue
        if in_tags:
            if line.strip().startswith("- "):
                tags.append(line.strip()[2:].strip())
            else:
                in_tags = False
    return tags


def classify(tags):
    """Return (wing, room) based on tags. First match wins."""
    wing, room = None, None
    for tag in tags:
        t = tag.lower().strip()
        if not wing and t in TAG_TO_WING:
            wing = TAG_TO_WING[t]
        if not room and t in TAG_TO_ROOM:
            room = TAG_TO_ROOM[t]
        if wing and room:
            break

    # Fallback: use first meaningful tag as room
    if wing and not room:
        for tag in tags:
            t = tag.lower().strip()
            if t not in ("xbl", "q-brain", "dischem", "urgent", "active"):
                room = t
                break

    return wing, room


def main():
    client = chromadb.PersistentClient(path=PALACE_PATH)
    col = client.get_collection("mempalace_drawers")

    print(f"\n{'DRY RUN — no changes will be made' if DRY_RUN else 'LIVE RUN — updating palace'}")
    print(f"Palace: {PALACE_PATH}\n")

    all_data = col.get(include=["metadatas"])
    ids = all_data["ids"]
    metas = all_data["metadatas"]

    stats = Counter()
    junk_ids = []
    recategorised = []
    unclassified_files = Counter()

    for i, meta in enumerate(metas):
        sf = meta.get("source_file", "")
        drawer_id = ids[i]

        # ── Phase 1: Identify junk (.obsidian files) ──
        if "/.obsidian/" in sf:
            junk_ids.append(drawer_id)
            stats["junk"] += 1
            continue

        # ── Phase 2: Re-categorise q-brain drawers using tags ──
        if "/q-brain/" in sf or "/fleeting/" in sf or "/permanent/" in sf:
            tags = extract_tags_from_file(sf)
            if tags:
                wing, room = classify(tags)
                if wing:
                    old_wing = meta.get("wing", "")
                    old_room = meta.get("room", "")
                    room = room or old_room
                    if wing != old_wing or room != old_room:
                        recategorised.append((drawer_id, wing, room, old_wing, old_room, sf))
                        stats["recategorised"] += 1
                    else:
                        stats["unchanged"] += 1
                else:
                    stats["no-match"] += 1
                    unclassified_files[os.path.basename(sf)] += 1
            else:
                stats["no-tags"] += 1
                unclassified_files[os.path.basename(sf)] += 1
        else:
            stats["other"] += 1

    # ── Report ──
    print("=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"  Total drawers:    {len(ids)}")
    print(f"  Junk to purge:    {stats['junk']}")
    print(f"  To recategorise:  {stats['recategorised']}")
    print(f"  Already correct:  {stats['unchanged']}")
    print(f"  No tag match:     {stats['no-match']}")
    print(f"  No tags at all:   {stats['no-tags']}")
    print(f"  Other (kept):     {stats['other']}")
    print()

    # Show wing distribution after recategorisation
    wing_counts = Counter()
    for _, wing, room, _, _, _ in recategorised:
        wing_counts[wing] += 1
    if wing_counts:
        print("  New wing distribution:")
        for w, c in wing_counts.most_common():
            print(f"    {w:<20} {c:>5} drawers")
        print()

    if unclassified_files:
        print(f"  Top unclassified files ({sum(unclassified_files.values())} drawers):")
        for f, c in unclassified_files.most_common(10):
            print(f"    {c:>4} {f}")
        print()

    # Show sample recategorisations
    if recategorised:
        print("  Sample moves:")
        for did, wing, room, ow, orr, sf in recategorised[:8]:
            fn = os.path.basename(sf)
            print(f"    {fn[:40]:<42} {ow}/{orr} → {wing}/{room}")
        print()

    if DRY_RUN:
        print("  Run without --dry-run to apply.\n")
        return

    # ── Apply: Purge junk ──
    if junk_ids:
        print(f"  Purging {len(junk_ids)} junk drawers...", end=" ", flush=True)
        batch = 500
        for i in range(0, len(junk_ids), batch):
            col.delete(ids=junk_ids[i : i + batch])
        print("done.")

    # ── Apply: Update metadata ──
    if recategorised:
        print(f"  Updating {len(recategorised)} drawers...", end=" ", flush=True)
        batch = 500
        for i in range(0, len(recategorised), batch):
            chunk = recategorised[i : i + batch]
            batch_ids = [r[0] for r in chunk]
            # Get current full metadata
            existing = col.get(ids=batch_ids, include=["metadatas"])
            new_metas = []
            for j, meta in enumerate(existing["metadatas"]):
                meta["wing"] = chunk[j][1]
                meta["room"] = chunk[j][2]
                new_metas.append(meta)
            col.update(ids=batch_ids, metadatas=new_metas)
        print("done.")

    print(f"\n  ✓ Palace updated. Run `mempalace status` to verify.\n")


if __name__ == "__main__":
    main()
