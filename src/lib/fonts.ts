const FONTS = [
  // Core UI + common creative fonts (loaded on demand)
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Playfair Display', 'Merriweather', 'Lora', 'DM Sans',
  'JetBrains Mono', 'Fira Code', 'Source Code Pro',
  'Bebas Neue', 'Oswald', 'Righteous', 'Lobster', 'Pacifico',
  'Dancing Script', 'Caveat', 'Permanent Marker',
]

const loadedFonts = new Set<string>()

export function preloadFonts() {
  // Only preload Inter — the UI font
  loadFont('Inter')
}

export function loadFont(fontFamily: string) {
  if (loadedFonts.has(fontFamily)) return
  loadedFonts.add(fontFamily)

  const url = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

export function getAvailableFonts(): string[] {
  return [...FONTS]
}

export function isFontLoaded(fontFamily: string): boolean {
  return loadedFonts.has(fontFamily)
}
