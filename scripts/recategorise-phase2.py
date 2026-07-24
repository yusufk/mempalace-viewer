#!/usr/bin/env python3
"""
Phase 2: Classify remaining bigly drawers by content keywords.
Handles: untagged .md files, memory.json entities, CSVs, scripts.

Usage:
  python scripts/recategorise-phase2.py --dry-run
  python scripts/recategorise-phase2.py
"""
import os
import re
import sys
import chromadb
from collections import Counter

PALACE_PATH = os.path.expanduser("~/.mempalace/palace")
DRY_RUN = "--dry-run" in sys.argv

# Content keyword patterns → (wing, room)
# Checked against drawer content (case-insensitive). First match wins.
RULES = [
    # Old memory bank entities → memories wing (check FIRST - JSON structure)
    (r'"type"\s*:\s*"entity"|"entityType"|"observations"\s*:', "memories", "entities"),
    (r'"type"\s*:\s*"relation"|"relations"\s*:', "memories", "relations"),

    # Health (before technical to catch prescription/pharmacy)
    (r"pharmacy|prescription|dispensary|script.*manag", "health", "pharmacy"),
    (r"health.*hub|clinic.*book|health.*service", "health", "health-platform"),

    # CDC / Customer identity
    (r"CDC|customer data cloud|gigya|SAP CDC|registration.*(flow|scenario|match)", "customer", "cdc"),
    (r"CRM|loyalty.*program|better rewards|benefit.*points", "customer", "loyalty"),
    (r"customer.*(journey|experience|engagement)", "customer", "experience"),

    # Technical
    (r"solr|search.*index|search.*config|query.*parser", "technical", "search"),
    (r"AWS|EKS|fargate|CloudFormation|VPC|lambda|S3 bucket", "technical", "aws"),
    (r"commerce.?cloud|hybris|spartacus|SAP Commerce|ccv2", "technical", "commerce-cloud"),
    (r"architect|system.*design|integration.*pattern|domain.*boundar", "technical", "architecture"),
    (r"API|endpoint|swagger|postman|REST|GraphQL", "technical", "api"),
    (r"FHIR|azure.*health|health.*data.*service", "technical", "health-tech"),
    (r"CI/CD|pipeline|deploy|docker|kubernetes|helm", "technical", "devops"),
    (r"authentication|auth.*flow|login.*flow|identity.*manag", "technical", "auth"),

    # Strategy
    (r"store.?of.?(the)?.?future|SOTF|melrose.*arch", "strategy", "store-of-future"),
    (r"roadmap|12.?month|digital.*channel.*road", "strategy", "roadmap"),
    (r"product.*vision|product.*strategy|app.*strategy", "strategy", "product-vision"),
    (r"wireframe|mockup|screen.*design|user.*flow", "strategy", "ux-design"),

    # Analytics
    (r"GA4|google.*analytics|page.*view|session.*data|bounce.*rate", "analytics", "analytics"),
    (r"user.*projection|growth.*model|forecast|conversion.*rate", "analytics", "projections"),
    (r"navigation.*behav|category.*traffic|click.*pattern", "analytics", "navigation"),
    (r"revenue|basket.*size|order.*value|sales.*data", "analytics", "revenue"),

    # Governance
    (r"risk.*register|risk.*assessment|mitigation.*plan", "governance", "risk"),
    (r"meeting.*notes|minutes|action.*items|attendees", "governance", "meetings"),
    (r"QBR|quarterly.*review|quarter.*business", "governance", "qbr"),
    (r"steerco|steering.*committee", "governance", "steerco"),
    (r"Patterson.*level|job.*description|JD.*tribe|role.*description", "people", "hiring"),

    # Operations
    (r"fulfilment|fulfillment|delivery.*slot|click.*collect|order.*track", "operations", "fulfilment"),
    (r"payment|PayGate|checkout.*flow|transaction", "operations", "payments"),
    (r"OAA|stock.*manag|inventory|order.*alloc", "operations", "stock"),
    (r"incident|outage|P1.*issue|escalat", "operations", "incidents"),

    # Health
    (r"pharmacy|prescription|dispensary|script.*manag", "health", "pharmacy"),
    (r"health.*hub|clinic.*book|health.*service", "health", "health-platform"),

    # Commerce
    (r"black.*friday|peak.*trading|promotional.*campaign", "commerce", "black-friday"),
    (r"pricing|discount|promo.*rule|markdown", "commerce", "pricing"),
    (r"privacy.*policy|terms.*condition|POPIA|GDPR", "commerce", "legal"),

    # Security
    (r"WAF|firewall|security.*patch|vulnerabilit|PCI|fraud", "security", "security"),

    # People
    (r"squad.*structure|team.*structure|org.*chart|tribe.*structure", "people", "squads"),
    (r"McKinsey|consultant|advisory", "people", "consultants"),
    (r"vendor|Vaimo|Palota|HealthWindow|Health Window", "people", "vendors"),
]


def classify_content(text):
    """Match content against keyword rules."""
    for pattern, wing, room in RULES:
        if re.search(pattern, text[:3000], re.IGNORECASE):
            return wing, room
    return None, None


def main():
    client = chromadb.PersistentClient(path=PALACE_PATH)
    col = client.get_collection("mempalace_drawers")

    print(f"\n{'DRY RUN' if DRY_RUN else 'LIVE RUN'}")
    print(f"Palace: {PALACE_PATH}\n")

    r = col.get(where={"wing": "bigly"}, include=["documents", "metadatas"])
    ids, docs, metas = r["ids"], r["documents"], r["metadatas"]

    stats = Counter()
    updates = []  # (id, wing, room, old_room, filename)
    unclassified = Counter()

    for i, doc in enumerate(docs):
        meta = metas[i]
        drawer_id = ids[i]
        sf = meta.get("source_file", "")
        fname = os.path.basename(sf)
        old_room = meta.get("room", "general")

        wing, room = classify_content(doc)
        if wing:
            updates.append((drawer_id, wing, room, old_room, fname))
            stats["classified"] += 1
        else:
            stats["unclassified"] += 1
            unclassified[fname] += 1

    # ── Report ──
    print("=" * 60)
    print(f"  Bigly drawers:     {len(ids)}")
    print(f"  Classified:        {stats['classified']}")
    print(f"  Still unclassified: {stats['unclassified']}")
    print()

    wing_counts = Counter()
    for _, wing, room, _, _ in updates:
        wing_counts[wing] += 1
    print("  New wing distribution:")
    for w, c in wing_counts.most_common():
        print(f"    {w:<20} {c:>5}")
    print()

    if unclassified:
        print(f"  Remaining unclassified ({sum(unclassified.values())}):")
        for f, c in unclassified.most_common(10):
            print(f"    {c:>4} {f}")
        print()

    print("  Sample moves:")
    seen = set()
    for did, wing, room, old_room, fname in updates:
        if fname not in seen:
            seen.add(fname)
            print(f"    {fname[:42]:<44} bigly/{old_room} → {wing}/{room}")
        if len(seen) >= 10:
            break
    print()

    if DRY_RUN:
        print("  Run without --dry-run to apply.\n")
        return

    # ── Apply ──
    if updates:
        print(f"  Updating {len(updates)} drawers...", end=" ", flush=True)
        batch = 500
        for i in range(0, len(updates), batch):
            chunk = updates[i : i + batch]
            batch_ids = [u[0] for u in chunk]
            existing = col.get(ids=batch_ids, include=["metadatas"])
            new_metas = []
            for j, meta in enumerate(existing["metadatas"]):
                meta["wing"] = chunk[j][1]
                meta["room"] = chunk[j][2]
                new_metas.append(meta)
            col.update(ids=batch_ids, metadatas=new_metas)
        print("done.")

    print(f"\n  ✓ Run `mempalace status` to verify.\n")


if __name__ == "__main__":
    main()
