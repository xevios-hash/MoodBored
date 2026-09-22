import Base

# ─── Position & Size ────────────────────────────────────────────────────
type Position is Data:
  Pos{x: F32, y: F32}

type Size is Data:
  Size{w: F32, h: F32}

# ─── Color types ────────────────────────────────────────────────────────
type ColorStop is Data:
  CStop{position: F32, color: String}

type PaletteColor is Data:
  PColor{hex: String, label: String}

# ─── Item union ─────────────────────────────────────────────────────────
type Item is Data:
  Text{id: String, raw: String, pos: Position, size: Size}
  Image{
    id: String,
    thumbnail: String,
    full_source: String,
    description: String,
    purpose: String,
    importance: String,
    source: String,
    tags: List<&2, String>,
    gen_prompt: Maybe<&2, String>,
    pos: Position,
    size: Size
  }
  Link{
    id: String,
    url: String,
    title: String,
    summary: String,
    description: String,
    purpose: String,
    importance: String,
    source: String,
    tags: List<&2, String>,
    pos: Position
  }
  Note{
    id: String,
    text: String,
    purpose: String,
    importance: String,
    tags: List<&2, String>,
    pos: Position
  }
  Video{
    id: String,
    source: String,
    start_ts: F32,
    duration: F32,
    subject_desc: String,
    motion_desc: String,
    purpose: String,
    importance: String,
    source_url: String,
    tags: List<&2, String>,
    pos: Position,
    size: Size
  }
  Palette{
    id: String,
    label: String,
    colors: List<&2, PaletteColor>,
    purpose: String,
    importance: String,
    tags: List<&2, String>,
    pos: Position,
    size: Size
  }
  Gradient{
    id: String,
    label: String,
    stops: List<&2, ColorStop>,
    direction: F32,
    purpose: String,
    importance: String,
    tags: List<&2, String>,
    pos: Position,
    size: Size
  }
  FontPreview{
    id: String,
    font_family: String,
    weights: List<&2, U32>,
    sample_text: String,
    purpose: String,
    importance: String,
    tags: List<&2, String>,
    pos: Position,
    size: Size
  }
  Swatch{
    id: String,
    hex: String,
    name: String,
    usage: String,
    purpose: String,
    importance: String,
    tags: List<&2, String>,
    pos: Position,
    size: Size
  }
  SizeGuide{
    id: String,
    width: U32,
    height: U32,
    unit: String,
    label: String,
    orientation: String,
    purpose: String,
    importance: String,
    tags: List<&2, String>,
    pos: Position,
    size: Size
  }

# ─── Connector (separate from positioned items) ─────────────────────────
type ConnectorOwner is Data:
  User{}
  LLM{}
  Objective{}

type Connector is Data:
  Conn{
    id: String,
    from_id: String,
    to_id: String,
    label: String,
    style: String,
    owner: ConnectorOwner,
    purpose: String,
    tags: List<&2, String>
  }

# ─── Board element (either positioned item or connector) ────────────────
type BoardElement is Data:
  Positioned{item: Item}
  Connected{conn: Connector}

# ─── Viewport ───────────────────────────────────────────────────────────
type Viewport is Data:
  VP{
    id: String,
    name: String,
    elements: List<&2, BoardElement>,
    cam_x: F32,
    cam_y: F32,
    zoom: F32
  }

# ─── Settings ───────────────────────────────────────────────────────────
type Settings is Data:
  Set{
    api_key: String,
    default_model: String,
    jev_threshold: F32,
    theme: String,
    canvas_bg: U32
  }

# ─── Project ────────────────────────────────────────────────────────────
type Project is Data:
  Proj{
    id: String,
    name: String,
    viewports: List<&2, Viewport>,
    settings: Settings,
    created: String,
    updated: String
  }

# ─── Helper: get item id ────────────────────────────────────────────────
def Item.id(it: Item) -> String:
  match it:
    case Text{id, raw, pos, size}: id
    case Image{id, thumbnail, full_source, description, purpose, importance, source, tags, gen_prompt, pos, size}: id
    case Link{id, url, title, summary, description, purpose, importance, source, tags, pos}: id
    case Note{id, text, purpose, importance, tags, pos}: id
    case Video{id, source, start_ts, duration, subject_desc, motion_desc, purpose, importance, source_url, tags, pos, size}: id
    case Palette{id, label, colors, purpose, importance, tags, pos, size}: id
    case Gradient{id, label, stops, direction, purpose, importance, tags, pos, size}: id
    case FontPreview{id, font_family, weights, sample_text, purpose, importance, tags, pos, size}: id
    case Swatch{id, hex, name, usage, purpose, importance, tags, pos, size}: id
    case SizeGuide{id, width, height, unit, label, orientation, purpose, importance, tags, pos, size}: id

# ─── Helper: get item tags ──────────────────────────────────────────────
def Item.tags(it: Item) -> List<&2, String>:
  match it:
    case Text{id, raw, pos, size}: Nil{}
    case Image{id, thumbnail, full_source, description, purpose, importance, source, tags, gen_prompt, pos, size}: tags
    case Link{id, url, title, summary, description, purpose, importance, source, tags, pos}: tags
    case Note{id, text, purpose, importance, tags, pos}: tags
    case Video{id, source, start_ts, duration, subject_desc, motion_desc, purpose, importance, source_url, tags, pos, size}: tags
    case Palette{id, label, colors, purpose, importance, tags, pos, size}: tags
    case Gradient{id, label, stops, direction, purpose, importance, tags, pos, size}: tags
    case FontPreview{id, font_family, weights, sample_text, purpose, importance, tags, pos, size}: tags
    case Swatch{id, hex, name, usage, purpose, importance, tags, pos, size}: tags
    case SizeGuide{id, width, height, unit, label, orientation, purpose, importance, tags, pos, size}: tags

# ─── Helper: get item position ──────────────────────────────────────────
def Item.pos(it: Item) -> Position:
  match it:
    case Text{id, raw, pos, size}: pos
    case Image{id, thumbnail, full_source, description, purpose, importance, source, tags, gen_prompt, pos, size}: pos
    case Link{id, url, title, summary, description, purpose, importance, source, tags, pos}: pos
    case Note{id, text, purpose, importance, tags, pos}: pos
    case Video{id, source, start_ts, duration, subject_desc, motion_desc, purpose, importance, source_url, tags, pos, size}: pos
    case Palette{id, label, colors, purpose, importance, tags, pos, size}: pos
    case Gradient{id, label, stops, direction, purpose, importance, tags, pos, size}: pos
    case FontPreview{id, font_family, weights, sample_text, purpose, importance, tags, pos, size}: pos
    case Swatch{id, hex, name, usage, purpose, importance, tags, pos, size}: pos
    case SizeGuide{id, width, height, unit, label, orientation, purpose, importance, tags, pos, size}: pos

# ─── Helper: extract all text from an item for search ───────────────────
def Item.search_text(it: Item) -> String:
  match it:
    case Text{id, raw, pos, size}: raw
    case Image{id, thumbnail, full_source, description, purpose, importance, source, tags, gen_prompt, pos, size}:
      description ++ " " ++ purpose ++ " " ++ importance ++ " " ++ source
    case Link{id, url, title, summary, description, purpose, importance, source, tags, pos}:
      url ++ " " ++ title ++ " " ++ summary ++ " " ++ description ++ " " ++ purpose ++ " " ++ importance
    case Note{id, text, purpose, importance, tags, pos}:
      text ++ " " ++ purpose ++ " " ++ importance
    case Video{id, source, start_ts, duration, subject_desc, motion_desc, purpose, importance, source_url, tags, pos, size}:
      source ++ " " ++ subject_desc ++ " " ++ motion_desc ++ " " ++ purpose ++ " " ++ importance ++ " " ++ source_url
    case Palette{id, label, colors, purpose, importance, tags, pos, size}:
      label ++ " " ++ purpose ++ " " ++ importance
    case Gradient{id, label, stops, direction, purpose, importance, tags, pos, size}:
      label ++ " " ++ purpose ++ " " ++ importance
    case FontPreview{id, font_family, weights, sample_text, purpose, importance, tags, pos, size}:
      font_family ++ " " ++ sample_text ++ " " ++ purpose ++ " " ++ importance
    case Swatch{id, hex, name, usage, purpose, importance, tags, pos, size}:
      hex ++ " " ++ name ++ " " ++ usage ++ " " ++ purpose ++ " " ++ importance
    case SizeGuide{id, width, height, unit, label, orientation, purpose, importance, tags, pos, size}:
      label ++ " " ++ unit ++ " " ++ orientation ++ " " ++ purpose ++ " " ++ importance

# ─── Helper: collect all items from all viewports ───────────────────────
def Viewport.all_elements(vp: Viewport) -> List<&2, BoardElement>:
  match vp:
    case VP{id, name, elements, cam_x, cam_y, zoom}: elements

def flat_map_vp(vps: List<&2, Viewport>) -> List<&2, BoardElement>:
  match vps:
    case Nil{}: Nil{}
    case vp <> rest:
      List.append(&2, BoardElement, Viewport.all_elements(vp), flat_map_vp(rest))

def Project.all_elements(p: Project) -> List<&2, BoardElement>:
  match p:
    case Proj{id, name, viewports, settings, created, updated}:
      flat_map_vp(viewports)
