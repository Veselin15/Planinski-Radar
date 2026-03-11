import hashlib
import os
from datetime import datetime
from urllib.parse import urljoin
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup
from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone

from .models import Hut, OfficialAlert, WebcamSnapshot

DEFAULT_HEADERS = {
    # Use a desktop user-agent to avoid simplified anti-bot responses.
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    )
}


def _normalize_text(value: str) -> str:
    # Normalize whitespace to make deduplication hashes stable.
    return " ".join((value or "").split())


def _extract_feed_items_from_rss(xml_payload: str):
    # Parse RSS entries into a uniform intermediate structure.
    root = ElementTree.fromstring(xml_payload)
    channel = root.find("channel")
    if channel is None:
        return []

    items = []
    for item in channel.findall("item"):
        title = _normalize_text(item.findtext("title", default=""))
        description = _normalize_text(item.findtext("description", default=""))
        link = _normalize_text(item.findtext("link", default=""))
        pub_date = _normalize_text(item.findtext("pubDate", default=""))
        items.append(
            {
                "title": title,
                "description": description,
                "source_url": link or None,
                "published_raw": pub_date or None,
            }
        )
    return items


def _extract_feed_items_from_html(html_payload: str, base_url: str):
    # Fallback parser for websites without RSS support.
    soup = BeautifulSoup(html_payload, "html.parser")
    candidates = soup.select("article, .post, .news-item, li")

    items = []
    for candidate in candidates[:30]:
        heading = candidate.find(["h1", "h2", "h3", "h4"])
        paragraph = candidate.find("p")
        anchor = candidate.find("a", href=True)
        title = _normalize_text(heading.get_text(" ", strip=True) if heading else "")
        description = _normalize_text(paragraph.get_text(" ", strip=True) if paragraph else "")
        if not title and not description:
            continue
        source_url = None
        if anchor:
            source_url = urljoin(base_url, anchor["href"])
        items.append(
            {
                "title": title or "Официален бюлетин",
                "description": description or title,
                "source_url": source_url,
                "published_raw": None,
            }
        )

    return items


def _extract_candidate_image_urls(html_payload: str, base_url: str):
    # Collect candidate image URLs from common metadata and content tags.
    soup = BeautifulSoup(html_payload, "html.parser")
    candidates = []

    for selector in (
        "meta[property='og:image']",
        "meta[name='twitter:image']",
        "meta[property='og:image:url']",
    ):
        tag = soup.select_one(selector)
        if tag and tag.get("content"):
            candidates.append(urljoin(base_url, tag["content"]))

    for img in soup.select("img[src]"):
        src = img.get("src", "").strip()
        if not src:
            continue
        absolute_src = urljoin(base_url, src)
        lower_src = absolute_src.lower()
        if any(ext in lower_src for ext in (".jpg", ".jpeg", ".png", ".webp")):
            candidates.append(absolute_src)

    # Return unique URLs while preserving the original order.
    return list(dict.fromkeys(candidates))


def _resolve_webcam_image_url(source_url: str):
    # Resolve a direct image URL from either an image endpoint or HTML camera page.
    response = requests.get(source_url, timeout=20, headers=DEFAULT_HEADERS)
    response.raise_for_status()
    content_type = response.headers.get("Content-Type", "").lower()

    if "image" in content_type:
        return source_url

    html_payload = response.text
    candidates = _extract_candidate_image_urls(html_payload, source_url)
    if candidates:
        return candidates[0]

    # Fallback: inspect one iframe level for embedded camera feeds.
    soup = BeautifulSoup(html_payload, "html.parser")
    iframe = soup.select_one("iframe[src]")
    if iframe and iframe.get("src"):
        iframe_url = urljoin(source_url, iframe["src"])
        iframe_response = requests.get(iframe_url, timeout=20, headers=DEFAULT_HEADERS)
        iframe_response.raise_for_status()
        iframe_type = iframe_response.headers.get("Content-Type", "").lower()
        if "image" in iframe_type:
            return iframe_url

        iframe_candidates = _extract_candidate_image_urls(iframe_response.text, iframe_url)
        if iframe_candidates:
            return iframe_candidates[0]

    return None


@shared_task(bind=True, autoretry_for=(requests.RequestException,), retry_backoff=True, max_retries=3)
def scrape_official_alerts(self):
    """
    Fetch official mountain alerts and upsert unique entries by content hash.
    """

    source_url = os.getenv("PSS_ALERTS_URL", "").strip()
    source_name = os.getenv("PSS_ALERTS_SOURCE_NAME", "ПСС")
    if not source_url:
        # Skip gracefully when source URL is not configured yet.
        return {"created": 0, "reason": "missing_source_url"}

    response = requests.get(source_url, timeout=20)
    response.raise_for_status()
    payload = response.text

    items = []
    content_type = response.headers.get("Content-Type", "").lower()
    if "xml" in content_type or payload.lstrip().startswith("<?xml"):
        try:
            items = _extract_feed_items_from_rss(payload)
        except ElementTree.ParseError:
            items = _extract_feed_items_from_html(payload, source_url)
    else:
        items = _extract_feed_items_from_html(payload, source_url)

    created_count = 0
    for item in items:
        hash_source = f"{item['title']}|{item['description']}|{item.get('source_url')}"
        content_hash = hashlib.sha256(hash_source.encode("utf-8")).hexdigest()
        if OfficialAlert.objects.filter(content_hash=content_hash).exists():
            continue

        published_at = None
        if item.get("published_raw"):
            try:
                published_at = datetime.strptime(item["published_raw"], "%a, %d %b %Y %H:%M:%S %z")
            except ValueError:
                published_at = timezone.now()

        OfficialAlert.objects.create(
            source=source_name,
            title=item["title"][:255] or "Официален бюлетин",
            description=item["description"] or item["title"] or "Няма описание.",
            source_url=item.get("source_url"),
            content_hash=content_hash,
            published_at=published_at,
            is_active=True,
        )
        created_count += 1

    return {"created": created_count, "scanned": len(items)}


@shared_task(bind=True, autoretry_for=(requests.RequestException,), retry_backoff=True, max_retries=3)
def fetch_webcam_snapshots(self):
    """
    Fetch webcam frames for huts and cache them as image files.
    """

    huts = Hut.objects.exclude(webcam_url__isnull=True).exclude(webcam_url__exact="")
    created_count = 0
    failed_count = 0

    for hut in huts:
        try:
            resolved_image_url = _resolve_webcam_image_url(hut.webcam_url)
            if not resolved_image_url:
                raise requests.RequestException("Could not resolve image URL from webcam page.")

            response = requests.get(resolved_image_url, timeout=20, headers=DEFAULT_HEADERS)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "").lower()
            if "image" not in content_type:
                raise requests.RequestException("Webcam response is not an image.")

            extension = "jpg"
            if "png" in content_type:
                extension = "png"
            filename = f"hut_{hut.id}_{int(timezone.now().timestamp())}.{extension}"

            snapshot = WebcamSnapshot.objects.create(
                hut=hut,
                source_url=resolved_image_url,
                status=WebcamSnapshot.SnapshotStatus.SUCCESS,
            )
            snapshot.image.save(filename, ContentFile(response.content), save=True)
            created_count += 1
        except Exception as error:
            WebcamSnapshot.objects.create(
                hut=hut,
                source_url=hut.webcam_url,
                status=WebcamSnapshot.SnapshotStatus.FAILED,
                error_message=str(error)[:500],
            )
            failed_count += 1

    return {"created": created_count, "failed": failed_count, "scanned_huts": huts.count()}
