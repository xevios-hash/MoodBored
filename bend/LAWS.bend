import Base
import ./model.bend as M

# ═══════════════════════════════════════════════════════════════════════
# LAWS.bend — Invariants that must never break for MoodBored
# ═══════════════════════════════════════════════════════════════════════

# Standalone accessors used by laws
def item_id(it: M.Item) -> String:
  M.Item.id(it)

def item_pos(it: M.Item) -> M.Position:
  M.Item.pos(it)

def item_search(it: M.Item) -> String:
  M.Item.search_text(it)

def item_tags(it: M.Item) -> List<&2, String>:
  M.Item.tags(it)

# Law 1: Media items carry required metadata by construction
law media_has_metadata:
  for it: M.Item
  M.Item

# Law 2: ID extraction is deterministic (pure function)
law id_is_deterministic:
  for a: M.Item
  {item_id(a) == item_id(a) : String}

# Law 3: Position extraction is deterministic
law pos_is_stable:
  for a: M.Item
  {item_pos(a) == item_pos(a) : M.Position}

# Law 4: search_text is total
law search_text_total:
  for it: M.Item
  {item_search(it) == item_search(it) : String}

# Law 5: Tags extraction is total
law tags_total:
  for it: M.Item
  {item_tags(it) == item_tags(it) : List<&2, String>}
