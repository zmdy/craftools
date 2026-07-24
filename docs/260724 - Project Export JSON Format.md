# Project Export JSON Format

**Date:** 2026-07-24  
**Status:** Design approved — pending implementation

---

## Overview

CrafTools will support exporting and saving projects in a structured JSON format compressed with gzip, using the `.craftools` file extension. Two storage modes will be available, selectable by the user at export time.

---

## File Format

### Container

```
.craftools   →   gzip( JSON )
```

The root JSON object has the following shape:

```jsonc
{
  "version": 1,
  "mode": "embedded" | "cloud",
  "meta": { ... },
  "pages": [ ... ],
  "assets": { ... }   // embedded mode only
}
```

### `meta` block

```json
{
  "title": "My Project",
  "created_at": "2026-07-24T15:30:00Z",
  "updated_at": "2026-07-24T16:00:00Z",
  "author": "user@example.com",
  "thumbnail": "data:image/png;base64,..."
}
```

### `pages` array

Each page entry mirrors the existing `PageState` from `StateSerializer`:

```jsonc
{
  "id": "page-abc123",
  "cssText": "width:595px;height:842px;...",
  "elements": [
    {
      "id": "el-xyz789",
      "type": "image",
      "cssText": "position:absolute;left:50px;top:60px;...",
      "attributes": { "x": "50", "y": "60", "w": "200", "h": "200", "data-craftool": "image" },
      "dataset": { "ctId": "el-xyz789", "ctState": "{\"objectFit\":\"cover\",...}" },
      "contentHTML": "<div class=\"ct-content-area\">...</div>",
      "meta": { "src": "asset://sha256:e3b0c44...", "zoom": 1.2, "filters": { ... } }
    }
  ]
}
```

---

## Storage Modes

### Mode 1 — Embedded (`"mode": "embedded"`)

All binary assets (images, etc.) are base64-encoded and stored inline in the JSON file. The project is fully self-contained — no external dependencies.

```jsonc
{
  "mode": "embedded",
  "assets": {
    "sha256:e3b0c44...": {
      "mime": "image/png",
      "data": "iVBORw0KGgo..."   // base64
    }
  }
}
```

Asset references inside `elements[].meta.src` use the `asset://` URI scheme:

```
"src": "asset://sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
```

The exporter resolves each `asset://` URI against the `assets` map before writing the final file. The importer performs the reverse operation on load.

**Trade-offs:**
- ✅ Fully portable — single file, works offline, no server required
- ✅ Simple implementation — no API calls needed
- ⚠ Larger file size due to base64 overhead (~33%)
- ⚠ Not suitable for projects with many high-resolution images

---

### Mode 2 — Cloud (`"mode": "cloud"`)

Binary assets are uploaded to the CrafTools server (or stored in a local folder for self-hosted deployments). The JSON only contains `asset://` references; the `assets` block is absent.

```jsonc
{
  "mode": "cloud",
  "pages": [
    {
      "elements": [
        {
          "meta": {
            "src": "asset://sha256:e3b0c44..."
          }
        }
      ]
    }
  ]
  // no "assets" key
}
```

The server resolves `asset://sha256:<hash>` to the stored binary at load time.

**Trade-offs:**
- ✅ Small file size — JSON only, no binary payload
- ✅ Asset deduplication across all projects (content-addressable storage)
- ✅ Enables collaborative editing and sharing via URL
- ⚠ Requires server connectivity for asset resolution
- ⚠ More complex implementation (upload flow, error handling)

---

## Asset Storage — Content-Addressable

Assets are stored and identified by the **SHA-256 hash of their binary content**. This guarantees:

1. **Deduplication** — the same image uploaded 100 times across different projects is stored only once.
2. **Integrity** — the hash is both the key and the checksum; corruption is detectable.
3. **Immutability** — a given hash always refers to the same bytes, making caching trivial.

### Server-side schema (cloud mode)

```sql
-- Stores asset binaries (one row per unique file)
CREATE TABLE assets (
  hash       TEXT PRIMARY KEY,   -- SHA-256 hex digest
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Tracks which projects reference which assets (for GC)
CREATE TABLE project_assets (
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  asset_hash  TEXT REFERENCES assets(hash),
  PRIMARY KEY (project_id, asset_hash)
);

-- Projects table stores only metadata + thumbnail; never binary blobs
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  title       TEXT,
  mode        TEXT CHECK (mode IN ('embedded', 'cloud')),
  thumbnail   TEXT,            -- base64 PNG thumbnail (small)
  json_path   TEXT,            -- path/key to the .craftools file on disk/object storage
  created_at  TIMESTAMP DEFAULT now(),
  updated_at  TIMESTAMP DEFAULT now()
);
```

The DB never stores asset binary content — only metadata and references. Binaries live on disk or in object storage (S3/R2/local). Garbage collection runs by finding `assets` rows with no matching `project_assets` entry.

---

## ProjectSerializer (planned)

A new `ProjectSerializer` class will be responsible for producing and consuming `.craftools` files. It will **not** extend `StateSerializer` — instead it wraps it, adding the asset extraction and embedding/referencing layer on top.

```
ProjectSerializer.export(pagesWrapper, mode)
  → resolves all asset:// refs from _craftoolsMeta (ImageTool, etc.)
  → in embedded mode: base64-encodes each asset into the assets map
  → in cloud mode: uploads each asset (if not already present), stores hash refs
  → serializes pages via StateSerializer.serialize()
  → returns gzip( JSON )  →  .craftools blob

ProjectSerializer.import(blob)
  → decompresses + parses JSON
  → in embedded mode: hydrates asset:// refs from the inline assets map
  → in cloud mode: resolves asset:// refs via API calls
  → calls StateSerializer.reconcile() to restore the canvas DOM
```

---

## Why Not Store JSON in a Database Column?

Storing large JSON blobs directly in a DB column causes:

- Row bloat and slow `SELECT *` queries even when only metadata is needed
- Inability to diff or patch individual pages without loading the full document
- No deduplication of shared assets across projects

The adopted approach — DB for metadata/index, filesystem/object-storage for content, content-addressable assets — is the same pattern used by Git, Figma, and most modern design tools.

---

## Open Questions

- **Local (offline) mode:** should `cloud` assets resolve against a local folder path instead of an API endpoint when running offline? Requires a fallback resolver in `ProjectSerializer.import()`.
- **Version migration:** `"version": 1` field is reserved for future format upgrades; a migration layer will be needed when breaking changes are introduced.
- **Partial export:** exporting a single page (not the whole project) should be straightforward — filter `pages` array before serializing.
