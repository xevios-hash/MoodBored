import Base
import ./model.bend as M

# ═══════════════════════════════════════════════════════════════════════
# search.bend — Full-text search across all item fields
# ═══════════════════════════════════════════════════════════════════════

def prepend_if(cond: Bool, +x: M.Item, xs: List<&2, M.Item>) -> List<&2, M.Item>:
  match cond:
    case True{}: x <> xs
    case False{}: xs

@unsafe
def list_has(xs: List<&2, String>, +val: String) -> Bool:
  match xs:
    case Nil{}: False{}
    case h <> t:
      String.eq(h, val) || list_has(t, val)

def item_search_text(it: M.Item) -> String:
  M.Item.search_text(it)

def item_tags(it: M.Item) -> List<&2, String>:
  M.Item.tags(it)

@unsafe
def search_items(items: List<&2, M.Item>, +query: String) -> List<&2, M.Item>:
  match items:
    case Nil{}: Nil{}
    case +h <> t:
      prepend_if(String.contains(item_search_text(h), query), h, search_items(t, query))

@unsafe
def filter_by_tag(items: List<&2, M.Item>, +tag: String) -> List<&2, M.Item>:
  match items:
    case Nil{}: Nil{}
    case +h <> t:
      prepend_if(list_has(item_tags(h), tag), h, filter_by_tag(t, tag))

def apply_tag(items: List<&2, M.Item>, +tag: String, empty: Bool) -> List<&2, M.Item>:
  match empty:
    case True{}: items
    case False{}: filter_by_tag(items, tag)

def search(items: List<&2, M.Item>, query: String, +tag: String) -> List<&2, M.Item>:
  by_query = search_items(items, query)
  apply_tag(by_query, tag, String.eq(tag, ""))
