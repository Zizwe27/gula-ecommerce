// Ubuntu font family — loaded in app/_layout.tsx
// Use these constants everywhere instead of raw fontFamily strings

export const Fonts = {
  light:   'Ubuntu_300Light',
  regular: 'Ubuntu_400Regular',
  medium:  'Ubuntu_500Medium',
  bold:    'Ubuntu_700Bold',
}

// Reusable text style presets
export const Type = {
  // Display
  displayLg: { fontFamily: Fonts.bold,    fontSize: 40, lineHeight: 48, letterSpacing: -1 },
  displayMd: { fontFamily: Fonts.bold,    fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },

  // Headings
  h1: { fontFamily: Fonts.bold,    fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontFamily: Fonts.bold,    fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: Fonts.medium,  fontSize: 18, lineHeight: 24 },

  // Body
  bodyLg:  { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyMd:  { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20 },
  bodySm:  { fontFamily: Fonts.light,   fontSize: 13, lineHeight: 18 },

  // Labels & UI
  labelLg: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20 },
  labelMd: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18 },
  labelSm: { fontFamily: Fonts.medium, fontSize: 11, lineHeight: 16, letterSpacing: 0.5 },

  // Caption
  caption: { fontFamily: Fonts.light, fontSize: 12, lineHeight: 16 },
}
