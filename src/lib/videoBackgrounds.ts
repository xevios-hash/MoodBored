// Video Background Configuration
// Central source for all video backgrounds used in MoodBored

export interface VideoBackground {
  id: string
  url: string
  label: string
  category: 'nature' | 'abstract' | 'geometric' | 'space' | 'urban'
  brightness: 'dark' | 'medium' | 'light'  // Auto-selects theme
  author: string
  authorUrl: string
  license: string
  thumbnail?: string
}

// All available video backgrounds
export const VIDEO_BACKGROUNDS: VideoBackground[] = [
  // Nature
  {
    id: 'tropical-jungle',
    url: '/videos/tropical-jungle.mp4',
    label: 'Tropical Jungle',
    category: 'nature',
    brightness: 'light',  // Green foliage is bright
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/lush-tropical-jungle-with-palm-trees-and-greenery-34411623/',
    license: 'Pexels License (Free for personal and commercial use)',
  },
  {
    id: 'sky-day',
    url: '/sky-day.mp4',
    label: 'Daytime Sky',
    category: 'nature',
    brightness: 'light',  // Bright sky
    author: 'MoodBored',
    authorUrl: '',
    license: 'Original',
  },

  // Abstract
  {
    id: 'luminous-particles',
    url: '/videos/luminous-particles.mp4',
    label: 'Luminous Particles',
    category: 'abstract',
    brightness: 'dark',  // Dark background with glowing particles
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/luminous-particles-loop-with-tunnel-effect-11354070/',
    license: 'Pexels License (Free for personal and commercial use)',
  },
  {
    id: 'light-waves',
    url: '/videos/light-waves.mp4',
    label: 'Light Waves',
    category: 'abstract',
    brightness: 'dark',  // Dark background with light waves
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/vibrant-abstract-light-waves-on-dark-background-29377163/',
    license: 'Pexels License (Free for personal and commercial use)',
  },
  {
    id: 'organic-formations',
    url: '/videos/organic-formations.mp4',
    label: 'Organic Formations',
    category: 'abstract',
    brightness: 'dark',  // Dark abstract formations
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/abstract-organic-formations-in-motion-36458860/',
    license: 'Pexels License (Free for personal and commercial use)',
  },
  {
    id: 'neon-space',
    url: '/videos/neon-space.mp4',
    label: 'Neon Space',
    category: 'space',
    brightness: 'dark',  // Dark space with neon glows
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/dynamic-abstract-space-animation-with-neon-glows-35909871/',
    license: 'Pexels License (Free for personal and commercial use)',
  },

  // Geometric
  {
    id: 'geometric-vj',
    url: '/videos/geometric-vj.mp4',
    label: 'Geometric VJ',
    category: 'geometric',
    brightness: 'dark',  // Dark geometric patterns
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/mesmerizing-abstract-geometric-vj-loop-39662721/',
    license: 'Pexels License (Free for personal and commercial use)',
  },
  {
    id: 'fractal-animation',
    url: '/videos/fractal-animation.mp4',
    label: 'Fractal Animation',
    category: 'geometric',
    brightness: 'dark',  // Dark fractal patterns
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/hypnotic-abstract-fractal-animation-loop-39478038/',
    license: 'Pexels License (Free for personal and commercial use)',
  },
  {
    id: 'cg-vj-loop',
    url: '/videos/cg-vj-loop.mp4',
    label: 'CG VJ Loop',
    category: 'abstract',
    brightness: 'dark',  // Dark CG background
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/abstract-background-cg-hypnotic-vj-loop-18196311/',
    license: 'Pexels License (Free for personal and commercial use)',
  },

  // Space / Tunnel
  {
    id: 'red-spheres-tunnel',
    url: '/videos/red-spheres-tunnel.mp4',
    label: 'Red Spheres Tunnel',
    category: 'space',
    brightness: 'dark',  // Dark tunnel with red spheres
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/vibrant-abstract-tunnel-of-red-and-pink-spheres-33260736/',
    license: 'Pexels License (Free for personal and commercial use)',
  },

  // Maze
  {
    id: 'black-white-maze',
    url: '/videos/black-white-maze.mp4',
    label: 'Black & White Maze',
    category: 'geometric',
    brightness: 'medium',  // Mixed black and white
    author: 'Pexels',
    authorUrl: 'https://www.pexels.com/video/a-black-and-white-image-of-a-maze-17552070/',
    license: 'Pexels License (Free for personal and commercial use)',
  },
]

// Get a random video background
export function getRandomVideoBackground(): VideoBackground {
  const index = Math.floor(Math.random() * VIDEO_BACKGROUNDS.length)
  return VIDEO_BACKGROUNDS[index]
}

// Get video by ID
export function getVideoById(id: string): VideoBackground | undefined {
  return VIDEO_BACKGROUNDS.find(v => v.id === id)
}

// Get videos by category
export function getVideosByCategory(category: VideoBackground['category']): VideoBackground[] {
  return VIDEO_BACKGROUNDS.filter(v => v.category === category)
}

// Get all unique categories
export function getVideoCategories(): VideoBackground['category'][] {
  return [...new Set(VIDEO_BACKGROUNDS.map(v => v.category))]
}

// Get the default video (first one or random)
export function getDefaultVideo(): VideoBackground {
  return VIDEO_BACKGROUNDS[0]
}

// Get recommended theme based on video brightness
export function getRecommendedTheme(video: VideoBackground): 'dark' | 'light' {
  return video.brightness === 'light' ? 'light' : 'dark'
}

// Get video by URL
export function getVideoByUrl(url: string): VideoBackground | undefined {
  return VIDEO_BACKGROUNDS.find(v => v.url === url)
}

// Format video credits for display
export function formatVideoCredits(): string {
  const lines: string[] = ['# Video Background Credits', '']
  lines.push('MoodBored uses video backgrounds from the following sources:')
  lines.push('')

  for (const video of VIDEO_BACKGROUNDS) {
    lines.push(`## ${video.label}`)
    lines.push(`- **Author:** ${video.author}`)
    if (video.authorUrl) {
      lines.push(`- **Source:** [${video.authorUrl}](${video.authorUrl})`)
    }
    lines.push(`- **License:** ${video.license}`)
    lines.push('')
  }

  return lines.join('\n')
}