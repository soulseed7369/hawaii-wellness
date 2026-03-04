#!/usr/bin/env python3
"""
18_insert_first_article.py
Insert the inaugural "Hawaii Wellness" article into the articles table.
"""

import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.supabase_client import client as supabase

# ── Article content ───────────────────────────────────────────────────────────
TITLE   = "Hawaii Wellness: A Home for the Healing Community of Hawai\u02BBi"
SLUG    = "hawaii-wellness-home-for-healing-community"
AUTHOR  = "Marcus Woo"
EXCERPT = (
    "If you live in Hawai\u02BBi long enough, you start to realize something quietly remarkable. "
    "There are healers everywhere\u2014and Hawai\u02BBi Wellness was created to bring that network together."
)

BODY_HTML = """\
<p>If you live in Hawai\u02BBi long enough, you start to realize something quietly remarkable.</p>
<p>There are healers everywhere.</p>
<p>Not in some abstract way, but in the very real sense that nearly every town, every district, every small community across the islands has people dedicated to helping others return to balance. Acupuncturists, herbalists, bodyworkers, trauma therapists, energy healers, yoga teachers, breathwork guides, functional medicine doctors, and practitioners of many traditions that don\u2019t always fit neatly into categories.</p>
<p>Many of them have spent decades studying their craft. Some carry traditions passed through families or lineages. Others have come from around the world and planted roots here, drawn by the same deep sense that the islands are a place where healing work belongs.</p>
<p>And yet, even for those of us who live here, it can still be surprisingly difficult to find them.</p>
<p>Most practitioners rely on word of mouth. A friend tells you about someone in Waimea. Someone else mentions a bodyworker in Puna. A yoga teacher in Kona knows an herbalist in H\u014Dlualoa. Over time you begin to see the network, but it\u2019s scattered across conversations, communities, and small local circles.</p>
<p>Hawai\u02BBi Wellness was created to bring that network together.</p>
<p>The goal is simple: to create a central hub where the wellness practitioners of Hawai\u02BBi can be discovered, supported, and connected\u2014both with the community they serve and with each other.</p>
<p>This is not meant to replace the local relationships that make the islands special. If anything, it\u2019s meant to strengthen them.</p>

<h2>Starting Where We Live: The Big Island</h2>
<p>We\u2019re beginning here on the Island of Hawai\u02BBi.</p>
<p>Anyone who has spent time here knows that the Big Island carries a unique kind of presence. Five great mountains rise from the sea\u2014Kohala, Mauna Kea, Mauna Loa, Huala\u0304lai, and K\u012Blauea\u2014shaping everything from the winds to the rain to the plants that grow in each valley.</p>
<p>The island is constantly changing. New land is still being formed. Old lava flows slowly return to forest. Water cuts its way through ancient rock and feeds the farms below.</p>
<p>Living here reminds you that the land itself is alive.</p>
<p>For generations, healing traditions here grew in relationship with that living landscape. Today the island continues to attract people who are devoted to the work of healing\u2014whether through traditional practices, modern integrative medicine, or emerging approaches that bridge the two.</p>
<p>What has formed over time is a quiet but powerful community of practitioners, spread from Kohala to H\u0101m\u0101kua, from Kona to Puna.</p>
<p>Hawai\u02BBi Wellness is an attempt to make that community more visible and more connected.</p>

<h2>Why I\u2019m Building This</h2>
<p>This project also comes from my own life here.</p>
<p>I first arrived on the Big Island in 2011, after two years traveling in India studying yoga and meditation. It was an incredible time, but by the end of my travels I had also picked up several stomach illnesses that left my health in rough shape.</p>
<p>When I came to Hawai\u02BBi, I was simply looking for a place to recover.</p>
<p>At first I stayed with family and spent time letting my body settle again. Slowly my health returned. But what really changed was my relationship to the island itself. Over time Hawai\u02BBi stopped feeling like somewhere I had come to visit and started feeling like home.</p>
<p>I eventually spent several years working with a nonprofit in Kohala, getting to know the community there and the rhythms of the land. Later, with friends in South Kona, we started a small breadfruit cooperative focused on growing and sharing one of Hawai\u02BBi\u2019s most important traditional foods.</p>
<p>Life here unfolded the way it tends to\u2014through relationships, through land, through community.</p>
<p>Now, nearly fifteen years later, I find myself building something that connects many of those threads together.</p>

<h2>A Directory for the Islands</h2>
<p>Hawai\u02BBi Wellness is meant to serve the people who live here.</p>
<p>It\u2019s a place where you can explore the practitioners working across the islands, discover modalities you may not have heard of before, and connect with people whose work is rooted in helping others live healthier, more balanced lives.</p>
<p>It\u2019s also a place for practitioners themselves\u2014to be seen, to connect with peers, and to strengthen the larger healing ecosystem of Hawai\u02BBi.</p>
<p>We are starting with the Big Island, but over time the directory will grow to include practitioners across all of the Hawaiian Islands, creating a shared resource for the entire community.</p>
<p>There is already a powerful culture of healing here. This project simply hopes to give it a clearer map.</p>
"""

TAGS    = ["community", "about"]
ISLAND  = "big_island"

# ── Check if article already exists ──────────────────────────────────────────
existing = supabase.table("articles").select("id, slug").eq("slug", SLUG).execute()
if existing.data:
    print(f"Article already exists (id={existing.data[0]['id']}). Skipping insert.")
    sys.exit(0)

# ── Insert ────────────────────────────────────────────────────────────────────
payload = {
    "slug":          SLUG,
    "title":         TITLE,
    "excerpt":       EXCERPT,
    "body":          BODY_HTML,
    # "author" column requires migration 20260304000002 — apply in Supabase SQL editor first
    # "author":      AUTHOR,
    "cover_image_url": None,           # no cover image yet
    "island":        ISLAND,
    "tags":          TAGS,
    "featured":      True,
    "status":        "published",
    "published_at":  datetime.now(timezone.utc).isoformat(),
}

result = supabase.table("articles").insert(payload).execute()

if result.data:
    print(f"✅ Article inserted: id={result.data[0]['id']}, slug={SLUG}")
else:
    print(f"❌ Insert failed: {result}")
    sys.exit(1)
