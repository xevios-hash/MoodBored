import { describe, it, expect } from 'vitest'
import { isWebUrl, isSearchQuery, normalizeUrl, getDomain, getFaviconUrl, searchToUrl } from './browser-engine'

describe('browser-engine', () => {
  describe('isWebUrl', () => {
    it('returns true for http URLs', () => {
      expect(isWebUrl('http://example.com')).toBe(true)
    })

    it('returns true for https URLs', () => {
      expect(isWebUrl('https://example.com/path?q=1')).toBe(true)
    })

    it('returns true for domain-like strings', () => {
      expect(isWebUrl('example.com')).toBe(true)
    })

    it('returns false for plain text', () => {
      expect(isWebUrl('hello world')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isWebUrl('')).toBe(false)
    })
  })

  describe('isSearchQuery', () => {
    it('returns true for plain text', () => {
      expect(isSearchQuery('hello world')).toBe(true)
    })

    it('returns false for URLs', () => {
      expect(isSearchQuery('https://example.com')).toBe(false)
    })

    it('returns false for empty string', () => {
      expect(isSearchQuery('')).toBe(false)
    })

    it('returns false for JSON-like strings', () => {
      expect(isSearchQuery('{key: value}')).toBe(false)
    })
  })

  describe('normalizeUrl', () => {
    it('adds https to bare domains', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com')
    })

    it('keeps existing https', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com')
    })

    it('converts search queries to Google search', () => {
      const result = normalizeUrl('hello world')
      expect(result).toContain('google.com/search')
      expect(result).toContain('hello%20world')
    })
  })

  describe('getDomain', () => {
    it('extracts domain from URL', () => {
      expect(getDomain('https://www.example.com/path')).toBe('example.com')
    })

    it('removes www prefix', () => {
      expect(getDomain('https://www.google.com')).toBe('google.com')
    })

    it('returns empty string for invalid URL', () => {
      expect(getDomain('not a url')).toBe('')
    })
  })

  describe('getFaviconUrl', () => {
    it('returns Google favicon URL', () => {
      const result = getFaviconUrl('https://example.com')
      expect(result).toContain('google.com/s2/favicons')
      expect(result).toContain('example.com')
    })
  })

  describe('searchToUrl', () => {
    it('converts query to Google search URL', () => {
      const result = searchToUrl('hello world')
      expect(result).toContain('google.com/search')
      expect(result).toContain('hello%20world')
    })
  })
})