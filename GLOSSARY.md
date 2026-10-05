# Sutekkapakku

Sutekkapakku is a Telegram bot that collects stickers into personal sticker packs. This file fixes the
vocabulary used across the code, issues, and documentation.

## Language

### Packs

**Pack**:
A Telegram sticker set the bot maintains for one user and one sticker type (regular, animated, or video) — a
title, a shareable link, and up to 120 stickers. The packs overview lists a user's packs and lets them open,
browse, rename, and remove stickers from each one.
_Avoid_: Sticker set, collection, album

**Volume**:
A pack seen as one stage in its sticker type's history: `Vol. 1`, `Vol. 2`, and so on. The newest volume is
active; every earlier volume is archived and stays reachable.
_Avoid_: Batch, generation, iteration

**Active volume**:
The volume of a sticker type that currently receives new stickers — the type's newest non-archived volume. UI
copy may call it the active pack; code and documentation say active volume.
_Avoid_: Current volume, latest volume, open volume

**Archive**:
To retire a volume in place so it no longer accepts stickers, keeping its stickers and metadata intact
forever. Archived volumes appear after the active one in the packs overview and are never deleted or
rewritten.
_Avoid_: Close, retire, delete

**Overflow**:
The state of an active volume that cannot accept another sticker because Telegram caps sticker sets at 120.
On overflow the bot archives the volume, creates the next volume, and adds the sticker there — the user is
told what happened, never shown an error.
_Avoid_: Full error, STICKERS_TOO_MUCH

### UI

**Panel**:
An editable message with inline-keyboard buttons that represents a menu or pack view. Navigating between
panels edits the same message in place; if editing is impossible, the panel is sent as a new message instead.
_Avoid_: Screen, view, page

**Flow**:
A guided, multi-step interaction inside one chat — removing a sticker or renaming a pack — with a prompt,
expected input, and an explicit Cancel. A flow ends on completion, on cancel, or on expiry, so a user is never
trapped in one.
_Avoid_: Mode, wizard, session
